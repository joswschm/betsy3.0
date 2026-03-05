import type { HighlightedRow } from '@/types/commission';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CarnegieExtractionOptions {
  agentName: string; // e.g., "BETSY LINDELL"
}

/**
 * Extract all rows for a specific agent from Carnegie commission PDF
 * Uses Python subprocess with pypdf for reliable 3-column layout extraction
 *
 * RATIONALE:
 * Carnegie PDFs use a complex 3-column tabular layout with text items interleaved
 * in PDF.js output. pypdf's extract_text() handles this internally and preserves
 * logical line boundaries, making it far more reliable than coordinate-based
 * reconstruction in TypeScript.
 */
export async function extractCarnegieAgent(
  buffer: Buffer,
  options: CarnegieExtractionOptions
): Promise<HighlightedRow[]> {
  // Write PDF to temp file
  const tmpDir = os.tmpdir();
  const tmpPdfPath = path.join(tmpDir, `carnegie_${Date.now()}.pdf`);
  const tmpJsonPath = path.join(tmpDir, `carnegie_parsed_${Date.now()}.json`);

  fs.writeFileSync(tmpPdfPath, buffer);

  try {
    // Create a Python script to extract and parse the PDF
    const pythonScript = `
import json
import re
import sys
from pypdf import PdfReader

def parse_carnegie_row(line):
    """Parse a single Carnegie row to extract structured data"""
    # Fix spaces within numbers (PDF extraction artifact)
    line = re.sub(r'(\\d)\\s+(\\d)', r'\\1\\2', line)

    # Remove extra spaces
    line = re.sub(r'\\s+', ' ', line.strip())

    # Extract financial values from the end
    financial_pattern = r'([\\d,\\(\\)\\.-]+)\\s*\\$\\s+([\\d,\\(\\)\\.-]+)\\s*\\$\\s+([\\d.]+)%\\s+([\\d,\\(\\)\\.-]+)\\s*\\$\\s*$'
    match = re.search(financial_pattern, line)

    if not match:
        return None

    gross_usd = match.group(1).replace(',', '').replace('(', '-').replace(')', '')
    net_usd = match.group(2).replace(',', '').replace('(', '-').replace(')', '')
    comm_rate = match.group(3)
    comm_value = match.group(4).replace(',', '').replace('(', '-').replace(')', '')

    # Remove financial data from line to get the rest
    text_part = line[:match.start()].strip()

    # Extract invoice number
    invoice_match = re.search(r'(S[IN]\\d+)', text_part)
    invoice_no = invoice_match.group(1) if invoice_match else None

    # Extract product code
    product_match = re.search(r'(\\d{4}[A-Z]?/\\d+)', text_part)
    product_code = product_match.group(1) if product_match else None

    # Extract customer name
    customer_name = None
    if invoice_no:
        # Clean up text_part: remove agent code/name if present at start
        text_cleaned = re.sub(r'^114401\\s+BETSY LINDELL\\s+', '', text_part)

        # Allow optional letter before S[IN] (e.g., DSI, SN, SI)
        customer_match = re.match(r'^([A-Z\\s&\\-.]+?)\\s+(?:[A-Z])?S[IN]', text_cleaned)
        if customer_match:
            customer_name = customer_match.group(1).strip()

    # Extract specifier
    specifier = None
    if invoice_no and product_code:
        parts_between = re.search(rf'{invoice_no}\\s+(.+?)\\s+{re.escape(product_code)}', text_part)
        if parts_between:
            specifier = parts_between.group(1).strip()

    # Extract project name
    project_name = None
    if product_code:
        parts_after = re.search(rf'{re.escape(product_code)}\\s+(.+?)$', text_part)
        if parts_after:
            project_name = parts_after.group(1).strip()
            if project_name == '#N/A':
                project_name = None

    return {
        'customer_name': customer_name,
        'invoice_no': invoice_no,
        'specifier': specifier,
        'product_code': product_code,
        'project_name': project_name,
        'gross_usd': float(gross_usd) if gross_usd not in ['-', ''] else 0.0,
        'net_usd': float(net_usd) if net_usd not in ['-', ''] else 0.0,
        'comm_rate': float(comm_rate),
        'comm_value': float(comm_value) if comm_value not in ['-', ''] else 0.0,
        'raw_line': line
    }

def extract_and_parse_carnegie(pdf_path, agent_code='114401'):
    """Extract and parse agent's section from Carnegie PDF"""
    reader = PdfReader(pdf_path)
    parsed_entries = []

    for page_num, page in enumerate(reader.pages, 1):
        text = page.extract_text()
        lines = text.split('\\n')

        in_agent_section = False
        current_customer = None  # Track customer name for continuation rows
        current_invoice = None   # Track invoice number for continuation rows

        for line_idx, line in enumerate(lines):
            # Start of agent's section
            if agent_code in line and 'BETSY LINDELL' in line.upper() and 'TOTAL' not in line.upper():
                in_agent_section = True
                # Don't skip - check if this line also contains data
                # (sometimes section header and first row are combined)

            # End of agent's section
            if in_agent_section and 'BETSY LINDELL Total' in line:
                # Parse the total line
                total_entry = parse_carnegie_row(line)
                if total_entry:
                    total_entry['is_total'] = True
                    parsed_entries.append(total_entry)
                break

            # Parse lines in agent's section
            if in_agent_section and line.strip():
                entry = parse_carnegie_row(line)
                if entry:
                    entry['is_total'] = False
                    entry['page_num'] = page_num

                    # If this row has a customer name, update current_customer
                    if entry['customer_name']:
                        current_customer = entry['customer_name']
                    # If this row has NO customer name (continuation row), use current_customer
                    elif current_customer:
                        entry['customer_name'] = current_customer

                    # If this row has an invoice number, update current_invoice
                    if entry['invoice_no']:
                        current_invoice = entry['invoice_no']
                    # If this row has NO invoice number (continuation row), use current_invoice
                    elif current_invoice:
                        entry['invoice_no'] = current_invoice

                    parsed_entries.append(entry)

    return parsed_entries

# Main
try:
    entries = extract_and_parse_carnegie("${tmpPdfPath}")
    output = {
        'success': True,
        'entries': entries,
        'count': len(entries)
    }
    with open("${tmpJsonPath}", 'w') as f:
        json.dump(output, f)
except Exception as e:
    output = {
        'success': False,
        'error': str(e)
    }
    with open("${tmpJsonPath}", 'w') as f:
        json.dump(output, f)
`;

    // Write Python script to temp file
    const pythonScriptPath = path.join(tmpDir, `extract_carnegie_${Date.now()}.py`);
    fs.writeFileSync(pythonScriptPath, pythonScript);

    // Execute Python script
    await new Promise<void>((resolve, reject) => {
      const python = spawn('python3', [pythonScriptPath]);

      let errorOutput = '';

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python extraction failed with code ${code}: ${errorOutput}`));
        } else {
          resolve();
        }
      });

      python.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });
    });

    // Read results
    const jsonContent = fs.readFileSync(tmpJsonPath, 'utf-8');
    const result = JSON.parse(jsonContent);

    if (!result.success) {
      throw new Error(`Python extraction failed: ${result.error}`);
    }

    // Convert parsed entries to HighlightedRow format
    const allRows: HighlightedRow[] = [];

    for (const entry of result.entries) {
      // Skip $0 commission rows (except for total line)
      if (!entry.is_total && entry.comm_value === 0) {
        continue;
      }

      const row: HighlightedRow = {
        rowNumber: allRows.length + 1,
        cells: {
          Col1: entry.raw_line,
          Customer: entry.is_total ? 'TOTAL' : (entry.customer_name || ''),
          Invoice: entry.is_total ? '' : (entry.invoice_no || ''),
          Specifier: entry.is_total ? '' : (entry.specifier || ''),
          ProductCode: entry.is_total ? '' : (entry.product_code || ''),
          ProjectName: entry.is_total ? '' : (entry.project_name || ''),
          NetSales: entry.net_usd.toFixed(2),
          CommRate: entry.is_total ? '' : `${entry.comm_rate}%`,
          Commission: entry.comm_value.toFixed(2),
        },
        highlight: null,
      };

      allRows.push(row);
    }

    console.log(`[Carnegie] Extracted ${allRows.length} rows from BETSY LINDELL section`);
    return allRows;
  } finally {
    // Cleanup temp files
    try {
      fs.unlinkSync(tmpPdfPath);
    } catch (e) {
      // ignore
    }
    try {
      fs.unlinkSync(tmpJsonPath);
    } catch (e) {
      // ignore
    }
    try {
      const pythonScriptPath = path.join(tmpDir, `extract_carnegie_${Date.now()}.py`);
      fs.unlinkSync(pythonScriptPath);
    } catch (e) {
      // ignore
    }
  }
}
