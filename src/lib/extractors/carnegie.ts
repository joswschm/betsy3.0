import type { HighlightedRow } from '@/types/commission';

export interface CarnegieExtractionOptions {
  agentName: string; // e.g., "BETSY LINDELL"
}

interface CarnegieEntry {
  customer_name: string | null;
  invoice_no: string | null;
  specifier: string | null;
  product_code: string | null;
  project_name: string | null;
  gross_usd: number;
  net_usd: number;
  comm_rate: number;
  comm_value: number;
  raw_line: string;
  is_total: boolean;
}

function parseNum(s: string): number {
  const cleaned = s.replace(/,/g, '').replace(/\(/g, '-').replace(/\)/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseCarnegieRow(line: string): CarnegieEntry | null {
  // Fix digit-space-digit artifacts from PDF extraction (e.g. "1 234" → "1234")
  let cleaned = line.replace(/(\d)\s+(\d)/g, '$1$2');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Match financial values at end of line:
  // gross $  net $  rate%  commission $
  const financialPattern =
    /([\d,\(\)\.-]+)\s*\$\s+([\d,\(\)\.-]+)\s*\$\s+([\d.]+)%\s+([\d,\(\)\.-]+)\s*\$\s*$/;
  const match = cleaned.match(financialPattern);
  if (!match) return null;

  const grossUsd = parseNum(match[1]);
  const netUsd = parseNum(match[2]);
  const commRate = parseFloat(match[3]);
  const commValue = parseNum(match[4]);

  const textPart = cleaned.slice(0, match.index!).trim();

  // Extract invoice number (SI or SN prefix + digits)
  const invoiceMatch = textPart.match(/(S[IN]\d+)/);
  const invoiceNo = invoiceMatch ? invoiceMatch[1] : null;

  // Extract product code (e.g. "1234A/56")
  const productMatch = textPart.match(/(\d{4}[A-Z]?\/\d+)/);
  const productCode = productMatch ? productMatch[1] : null;

  // Extract customer name (text before invoice number, minus agent header)
  let customerName: string | null = null;
  if (invoiceNo) {
    const textCleaned = textPart.replace(/^114401\s+BETSY LINDELL\s+/, '');
    const customerMatch = textCleaned.match(/^([A-Z\s&\-.]+?)\s+(?:[A-Z])?S[IN]/);
    if (customerMatch) customerName = customerMatch[1].trim();
  }

  // Extract specifier (text between invoice number and product code)
  let specifier: string | null = null;
  if (invoiceNo && productCode) {
    const specMatch = textPart.match(
      new RegExp(`${invoiceNo}\\s+(.+?)\\s+${productCode.replace('/', '\\/')}`)
    );
    if (specMatch) specifier = specMatch[1].trim();
  }

  // Extract project name (text after product code)
  let projectName: string | null = null;
  if (productCode) {
    const projMatch = textPart.match(
      new RegExp(`${productCode.replace('/', '\\/')}\\s+(.+?)$`)
    );
    if (projMatch) {
      projectName = projMatch[1].trim();
      if (projectName === '#N/A') projectName = null;
    }
  }

  return {
    customer_name: customerName,
    invoice_no: invoiceNo,
    specifier,
    product_code: productCode,
    project_name: projectName,
    gross_usd: grossUsd,
    net_usd: netUsd,
    comm_rate: commRate,
    comm_value: commValue,
    raw_line: line,
    is_total: false,
  };
}

/**
 * Group PDF text items into lines by a given axis, then concatenate items
 * along the other axis to form readable strings.
 *
 * @param axis  'y' = standard (group by y, read left-to-right)
 *              'x' = rotated  (group by x, read top-to-bottom by y)
 */
function groupItemsIntoLines(
  items: Array<{ str: string; transform: number[]; width: number }>,
  axis: 'y' | 'x',
  tolerance: number = 3
): string[] {
  type LineGroup = {
    center: number;
    entries: Array<{ pos: number; endPos: number; str: string }>;
  };
  const lineGroups: LineGroup[] = [];

  for (const item of items) {
    // groupVal = axis we bucket on; sortVal = axis we read along
    const groupVal = axis === 'y' ? item.transform[5] : item.transform[4];
    const sortVal  = axis === 'y' ? item.transform[4] : item.transform[5];
    const endSort  = sortVal + item.width;

    const existing = lineGroups.find((g) => Math.abs(g.center - groupVal) <= tolerance);
    if (existing) {
      existing.entries.push({ pos: sortVal, endPos: endSort, str: item.str });
      existing.center = (existing.center + groupVal) / 2;
    } else {
      lineGroups.push({ center: groupVal, entries: [{ pos: sortVal, endPos: endSort, str: item.str }] });
    }
  }

  // Sort groups into reading order:
  //   y-axis: descending (top of page = high y → first line)
  //   x-axis: ascending  (left of page = low x → first line)
  if (axis === 'y') {
    lineGroups.sort((a, b) => b.center - a.center);
  } else {
    lineGroups.sort((a, b) => a.center - b.center);
  }

  const lines: string[] = [];
  for (const group of lineGroups) {
    group.entries.sort((a, b) => a.pos - b.pos);
    let lineText = '';
    let lastEnd = -Infinity;
    for (const entry of group.entries) {
      if (lineText === '') {
        lineText = entry.str;
      } else {
        const gap = entry.pos - lastEnd;
        lineText += (gap > 3 ? ' ' : '') + entry.str;
      }
      lastEnd = Math.max(lastEnd, entry.endPos);
    }
    if (lineText.trim()) lines.push(lineText);
  }

  return lines;
}

async function extractPDFLines(buffer: Buffer): Promise<string[][]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { join } = await import('path');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`;

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  const pages: string[][] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    type Item = { str: string; transform: number[]; width: number };
    const items = (textContent.items as Item[]).filter(
      (item) => item.str && item.str.trim() !== ''
    );

    // Try standard y-grouping first (works for most PDFs)
    const yLines = groupItemsIntoLines(items, 'y');

    // Check if y-grouping produces parseable Carnegie rows.
    // The financial pattern (gross$ net$ rate% comm$) is a reliable indicator.
    const financialPattern =
      /[\d,\(\)\.-]+\s*\$\s+[\d,\(\)\.-]+\s*\$\s+[\d.]+%\s+[\d,\(\)\.-]+\s*\$/;
    const parseableCount = yLines.filter((line) => financialPattern.test(line)).length;

    if (parseableCount > 0) {
      // Standard layout — y-grouping worked
      pages.push(yLines);
    } else {
      // Rotated/transposed layout (e.g. Carnegie): each invoice is a vertical
      // column in the PDF. Group by x-position instead so each column becomes
      // one text line that parseCarnegieRow can handle.
      console.log(
        `[Carnegie] Page ${pageNum}: y-grouping produced 0 parseable rows, switching to x-grouping`
      );
      const xLines = groupItemsIntoLines(items, 'x', 2.7);
      pages.push(xLines);
    }
  }

  return pages;
}

export async function extractCarnegieAgent(
  buffer: Buffer,
  options: CarnegieExtractionOptions
): Promise<HighlightedRow[]> {
  const agentCode = '114401';
  const agentName = options.agentName.toUpperCase(); // e.g. "BETSY LINDELL"

  const pages = await extractPDFLines(buffer);
  const allRows: HighlightedRow[] = [];

  for (const lines of pages) {
    let inAgentSection = false;
    let currentCustomer: string | null = null;
    let currentInvoice: string | null = null;

    for (const line of lines) {
      const upper = line.toUpperCase();

      // Start of agent section
      if (
        upper.includes(agentCode) &&
        upper.includes(agentName) &&
        !upper.includes('TOTAL')
      ) {
        inAgentSection = true;
        // Fall through — the header line may also contain data
      }

      // End of agent section
      if (inAgentSection && upper.includes(`${agentName} TOTAL`)) {
        const totalEntry = parseCarnegieRow(line);
        if (totalEntry) {
          totalEntry.is_total = true;
          allRows.push({
            rowNumber: allRows.length + 1,
            cells: {
              Col1: totalEntry.raw_line,
              Customer: 'TOTAL',
              Invoice: '',
              Specifier: '',
              ProductCode: '',
              ProjectName: '',
              NetSales: totalEntry.net_usd.toFixed(2),
              CommRate: '',
              Commission: totalEntry.comm_value.toFixed(2),
            },
          });
        }
        break;
      }

      if (!inAgentSection || !line.trim()) continue;

      const entry = parseCarnegieRow(line);
      if (!entry) continue;

      // Skip $0 commission rows
      if (entry.comm_value === 0) continue;

      // Carry forward customer/invoice for continuation rows
      if (entry.customer_name) {
        currentCustomer = entry.customer_name;
      } else if (currentCustomer) {
        entry.customer_name = currentCustomer;
      }

      if (entry.invoice_no) {
        currentInvoice = entry.invoice_no;
      } else if (currentInvoice) {
        entry.invoice_no = currentInvoice;
      }

      allRows.push({
        rowNumber: allRows.length + 1,
        cells: {
          Col1: entry.raw_line,
          Customer: entry.customer_name ?? '',
          Invoice: entry.invoice_no ?? '',
          Specifier: entry.specifier ?? '',
          ProductCode: entry.product_code ?? '',
          ProjectName: entry.project_name ?? '',
          NetSales: entry.net_usd.toFixed(2),
          CommRate: `${entry.comm_rate}%`,
          Commission: entry.comm_value.toFixed(2),
        },
      });
    }
  }

  console.log(`[Carnegie] Extracted ${allRows.length} rows from ${agentName} section`);
  return allRows;
}
