import type { HighlightedRow } from '@/types/commission';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface WITExtractionOptions {
  sectionCodes: string[];
}

const PYTHON_EXTRACTOR = `
import pdfplumber
import re
import sys

def parse_european_number(num_str):
    if not num_str or num_str.strip() == "":
        return 0.0
    cleaned = num_str.replace(" ", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def extract_wit_commissions(pdf_path, section_codes):
    results = []

    print(f"[PY] Opening PDF: {pdf_path}", flush=True)

    with pdfplumber.open(pdf_path) as pdf:
        all_text = ""
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                all_text += t + "\\n"

    lines = all_text.split("\\n")
    print(f"[PY] Total lines from PDF: {len(lines)}", flush=True)
    print(f"[PY] Total chars from PDF: {len(all_text)}", flush=True)

    current_section = None
    current_section_code = None
    current_customer_name = None
    last_full_row_data = None

    section_headers_found = []
    data_lines_matched = 0

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        i += 1
        if not line.strip():
            continue
        if any(x in line for x in ["US REPS COMMISSIONS PERIOD", "Project Customer P.O."]):
            continue

        section_match = re.match(r"^(\\d{4})\\s+BETSY\\s*&\\s*MELESSA\\s*\\(([A-Z]{2})\\)", line)
        if section_match:
            current_section_code = section_match.group(1)
            current_section = section_match.group(2)
            section_headers_found.append(f"{current_section_code} ({current_section})")
            print(f"[PY] Section found: {current_section_code} ({current_section}), in target: {current_section_code in section_codes}", flush=True)
            if current_section_code not in section_codes:
                current_section_code = None
                current_section = None
            last_full_row_data = None
            continue

        if current_section is None:
            continue
        if line.strip() in ["Sales rep", "Client"]:
            continue

        customer_match = re.match(r"^(\\d{6}(?:-[A-Z]+)?)\\s+([A-Z].*)", line)
        if customer_match:
            potential = customer_match.group(2)
            if not re.match(r"^\\d{4}-\\d{2}-\\d{2}", potential):
                current_customer_name = potential
                last_full_row_data = None
                continue

        if any(x in line for x in ["Invoice total", "Customer total", "Group total", "5649 WIT", "5652 WIT"]):
            continue
        if re.search(r"\\d+:\\d+:\\d+\\s+\\d+ of \\d+", line):
            continue

        trailing_pattern = r"(\\d+(?:\\s\\d{3})?,\\d+)\\s+(\\d+(?:\\s\\d{3})?,\\d+)\\s+(\\d+,\\d+)\\s+(\\d+,\\d+)\\s+(\\d+,\\d+)\\s*$"
        trailing_match = re.search(trailing_pattern, line)
        if not trailing_match:
            continue

        data_lines_matched += 1

        net_amount = parse_european_number(trailing_match.group(2))
        comm_rate = parse_european_number(trailing_match.group(4))
        comm_amount = parse_european_number(trailing_match.group(5))

        if comm_amount == 0.0:
            continue

        prefix = line[:trailing_match.start()].rstrip()
        date_pattern = r"\\d{4}-\\d{2}-\\d{2}"
        dates = re.findall(date_pattern, prefix)

        if len(dates) >= 2:
            tokens = prefix.split()
            po_number = tokens[0]
            invoice_date = dates[0]
            order_entry_date = dates[1]
            date1_idx = prefix.find(invoice_date)
            date2_idx = prefix.find(order_entry_date)
            between = prefix[date1_idx + len(invoice_date):date2_idx].strip().split()
            invoice_number = between[0] if len(between) > 0 else ""
            order_number = between[1] if len(between) > 1 else ""
            after_date2 = prefix[date2_idx + len(order_entry_date):].strip()
            after_tokens = after_date2.split()
            item_code = after_tokens[0] if len(after_tokens) > 0 else ""
            description = " ".join(after_tokens[1:]) if len(after_tokens) > 1 else ""
            last_full_row_data = {
                "customer_name": current_customer_name,
                "po_number": po_number,
                "invoice_number": invoice_number,
                "invoice_date": invoice_date,
                "order_number": order_number,
                "item_code": item_code,
                "description": description,
            }
        else:
            if last_full_row_data is None:
                continue
            tokens = prefix.split()
            last_full_row_data["item_code"] = tokens[0] if len(tokens) > 0 else ""
            last_full_row_data["description"] = " ".join(tokens[1:]) if len(tokens) > 1 else ""

        if last_full_row_data:
            results.append({
                "customer_name": last_full_row_data["customer_name"],
                "po_number": last_full_row_data["po_number"],
                "invoice_number": last_full_row_data["invoice_number"],
                "invoice_date": last_full_row_data["invoice_date"],
                "order_number": last_full_row_data["order_number"],
                "item_code": last_full_row_data["item_code"],
                "description": last_full_row_data["description"],
                "net_amount": net_amount,
                "comm_rate": comm_rate,
                "comm_amount": comm_amount,
                "state": current_section,
            })

    print(f"[PY] Section headers found: {section_headers_found}", flush=True)
    print(f"[PY] Data lines matched trailing pattern: {data_lines_matched}", flush=True)
    print(f"[PY] Total results: {len(results)}", flush=True)
    return results
`;

export async function extractWITSections(
  buffer: Buffer,
  options: WITExtractionOptions
): Promise<HighlightedRow[]> {
  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const tmpPdfPath = path.join(tmpDir, `wit_${ts}.pdf`);
  const tmpJsonPath = path.join(tmpDir, `wit_out_${ts}.json`);
  const runnerPath = path.join(tmpDir, `wit_runner_${ts}.py`);

  console.log(`[WIT] Writing PDF (${buffer.length} bytes) to: ${tmpPdfPath}`);
  fs.writeFileSync(tmpPdfPath, buffer);

  const pythonRunner = `
${PYTHON_EXTRACTOR}

import json

pdf_path = ${JSON.stringify(tmpPdfPath)}
section_codes = ${JSON.stringify(options.sectionCodes)}
out_path = ${JSON.stringify(tmpJsonPath)}

print(f"[PY] section_codes = {section_codes}", flush=True)

try:
    entries = extract_wit_commissions(pdf_path, section_codes)
    with open(out_path, 'w') as f:
        json.dump({'success': True, 'entries': entries}, f)
except Exception as e:
    import traceback
    tb = traceback.format_exc()
    print(f"[PY] EXCEPTION: {e}", flush=True)
    print(tb, flush=True)
    with open(out_path, 'w') as f:
        json.dump({'success': False, 'error': str(e), 'trace': tb}, f)
`;

  fs.writeFileSync(runnerPath, pythonRunner);
  console.log(`[WIT] Runner written to: ${runnerPath}`);

  let stdoutData = '';
  let stderrData = '';

  try {
    await new Promise<void>((resolve, reject) => {
      const python = spawn('python3', [runnerPath]);

      python.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python exited with code ${code}`));
        } else {
          resolve();
        }
      });

      python.on('error', (err) => {
        reject(new Error(`Failed to spawn python3: ${err.message}`));
      });
    });

    // Always log Python output for diagnostics
    if (stdoutData) console.log('[WIT Python stdout]\n' + stdoutData);
    if (stderrData) console.log('[WIT Python stderr]\n' + stderrData);

    if (!fs.existsSync(tmpJsonPath)) {
      throw new Error('WIT extraction produced no output file.');
    }

    const resultRaw = fs.readFileSync(tmpJsonPath, 'utf-8');
    console.log('[WIT] Raw JSON result:', resultRaw.slice(0, 500));

    const result = JSON.parse(resultRaw);

    if (!result.success) {
      throw new Error(`WIT extraction failed: ${result.error}\n${result.trace || ''}`);
    }

    const rows: HighlightedRow[] = result.entries.map((entry: any, idx: number) => ({
      rowNumber: idx + 1,
      cells: {
        Customer: entry.customer_name || '',
        PONumber: entry.po_number || '',
        Invoice: entry.invoice_number || '',
        InvoiceDate: entry.invoice_date || '',
        OrderNumber: entry.order_number || '',
        Item: entry.item_code || '',
        Description: entry.description || '',
        NetAmount: entry.net_amount.toFixed(2),
        CommRate: `${entry.comm_rate.toFixed(2)}%`,
        Commission: entry.comm_amount.toFixed(2),
        IsSplit: 'true',
        SplitWith: 'MELESSA REDDITT',
        Region: entry.state || '',
      },
      highlight: null,
    }));

    console.log(`[WIT] Extracted ${rows.length} rows`);
    return rows;
  } catch (err) {
    if (stdoutData) console.log('[WIT Python stdout]\n' + stdoutData);
    if (stderrData) console.log('[WIT Python stderr]\n' + stderrData);
    throw err;
  } finally {
    for (const f of [tmpPdfPath, tmpJsonPath, runnerPath]) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}