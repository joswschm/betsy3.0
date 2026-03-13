import type { HighlightedRow } from '@/types/commission';

export interface WITExtractionOptions {
  sectionCodes: string[]; // e.g. ["5651", "5652"] for Betsy's AL and TN sections
}

interface PDFTextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, x, y]
  width: number;
}

// Parse European-format numbers: "1 596,80" → 1596.80
function parseEuropeanNumber(numStr: string): number {
  if (!numStr || numStr.trim() === '') return 0;
  const cleaned = numStr.replace(/\s/g, '').replace(',', '.');
  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

// Extract all text lines from a PDF buffer using unpdf/pdfjs
async function extractPDFLines(buffer: Buffer): Promise<string[]> {
  // Use unpdf/pdfjs — a serverless-compatible pdfjs build with the worker
  // inlined. Same API as pdfjs-dist but works reliably on Vercel.
  const pdfjsLib = await import('unpdf/pdfjs');
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = (textContent.items as PDFTextItem[]).filter(
      (item) => item.str && item.str.trim() !== ''
    );

    if (items.length === 0) continue;

    // Group items into visual lines using y-position with 3pt tolerance
    // (items on the same printed line can have slightly different y values)
    type LineGroup = { centerY: number; entries: Array<{ x: number; endX: number; str: string }> };
    const lineGroups: LineGroup[] = [];

    for (const item of items) {
      const y = item.transform[5];
      const x = item.transform[4];
      const endX = x + item.width;

      const existing = lineGroups.find((g) => Math.abs(g.centerY - y) <= 3);
      if (existing) {
        existing.entries.push({ x, endX, str: item.str });
        // Update center toward new y
        existing.centerY = (existing.centerY + y) / 2;
      } else {
        lineGroups.push({ centerY: y, entries: [{ x, endX, str: item.str }] });
      }
    }

    // Sort lines top-to-bottom (PDF y=0 is bottom of page, so descending y = top)
    lineGroups.sort((a, b) => b.centerY - a.centerY);

    for (const group of lineGroups) {
      // Sort items left-to-right within each line
      group.entries.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lastEndX = -Infinity;

      for (const entry of group.entries) {
        if (lineText === '') {
          lineText = entry.str;
        } else {
          const gap = entry.x - lastEndX;
          // Add a space if there's a gap > 3pt between items (word/column spacing)
          lineText += (gap > 3 ? ' ' : '') + entry.str;
        }
        lastEndX = Math.max(lastEndX, entry.endX);
      }

      if (lineText.trim()) {
        allLines.push(lineText);
      }
    }
  }

  return allLines;
}

export async function extractWITSections(
  buffer: Buffer,
  options: WITExtractionOptions
): Promise<HighlightedRow[]> {
  const lines = await extractPDFLines(buffer);
  const { sectionCodes } = options;

  let currentSection: string | null = null;
  let currentSectionCode: string | null = null;
  let currentCustomerName: string | null = null;

  interface RowData {
    customer_name: string;
    po_number: string;
    invoice_number: string;
    invoice_date: string;
    order_number: string;
    item_code: string;
    description: string;
  }
  let lastFullRowData: RowData | null = null;

  interface WITEntry {
    customer_name: string | null;
    po_number: string;
    invoice_number: string;
    invoice_date: string;
    order_number: string;
    item_code: string;
    description: string;
    net_amount: number;
    comm_rate: number;
    comm_amount: number;
    state: string | null;
  }
  const results: WITEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    // Skip report header lines
    if (
      line.includes('US REPS COMMISSIONS PERIOD') ||
      line.includes('Project Customer P.O.')
    ) continue;

    // Match Betsy sections: "5651 BETSY & MELESSA (AL)"
    const sectionMatch = line.match(/^(\d{4})\s+BETSY\s*&\s*MELESSA\s*\(([A-Z]{2})\)/);
    if (sectionMatch) {
      currentSectionCode = sectionMatch[1];
      currentSection = sectionMatch[2];
      if (!sectionCodes.includes(currentSectionCode)) {
        currentSectionCode = null;
        currentSection = null;
      }
      lastFullRowData = null;
      continue;
    }

    // Detect ANY other section header (e.g. "5653 MELESSA REDDITT (MS)") — stop extracting
    const otherSection = line.match(/^(\d{4})\s+[A-Z].*\([A-Z]{2}\)/);
    if (otherSection && currentSection !== null) {
      currentSection = null;
      currentSectionCode = null;
      currentCustomerName = null;
      lastFullRowData = null;
      continue;
    }

    if (currentSection === null) continue;

    if (line.trim() === 'Sales rep' || line.trim() === 'Client') continue;

    // Customer header: 6-digit ID (optionally with suffix) followed by a name (not a date)
    const customerMatch = line.match(/^(\d{6}(?:-[A-Z]+)?)\s+([A-Z].*)/);
    if (customerMatch) {
      const potential = customerMatch[2];
      if (!/^\d{4}-\d{2}-\d{2}/.test(potential)) {
        currentCustomerName = potential;
        lastFullRowData = null;
        continue;
      }
    }

    // Skip total / subtotal lines
    if (
      ['Invoice total', 'Customer total', 'Group total', '5649 WIT', '5652 WIT'].some((x) =>
        line.includes(x)
      )
    ) continue;

    // Skip page number / timestamp lines (e.g. "14:32:01  1 of 3")
    if (/\d+:\d+:\d+\s+\d+ of \d+/.test(line)) continue;

    // Each data row ends with 5 European-formatted numbers:
    //   OrderQty  NetAmount  [something]  CommRate  CommAmount
    const trailingPattern =
      /(\d+(?:\s\d{3})?,\d+)\s+(\d+(?:\s\d{3})?,\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s*$/;
    const trailingMatch = line.match(trailingPattern);
    if (!trailingMatch) continue;

    const netAmount = parseEuropeanNumber(trailingMatch[2]);
    const commRate = parseEuropeanNumber(trailingMatch[4]);
    const commAmount = parseEuropeanNumber(trailingMatch[5]);

    if (commAmount === 0) continue;

    const prefix = line.slice(0, trailingMatch.index!).trimEnd();

    // Find all ISO dates in the prefix
    const dateMatches = Array.from(prefix.matchAll(/\d{4}-\d{2}-\d{2}/g)).map((m) => ({
      date: m[0],
      index: m.index!,
    }));

    if (dateMatches.length >= 2) {
      // Full row: PO  InvoiceDate  InvoiceNum  OrderNum  OrderDate  ItemCode  Description
      const tokens = prefix.split(/\s+/);
      const poNumber = tokens[0] ?? '';
      const invoiceDate = dateMatches[0].date;
      const orderEntryDate = dateMatches[1].date;
      const date1End = dateMatches[0].index + invoiceDate.length;
      const date2Start = dateMatches[1].index;
      const date2End = date2Start + orderEntryDate.length;

      const between = prefix.slice(date1End, date2Start).trim().split(/\s+/).filter(Boolean);
      const invoiceNumber = between[0] ?? '';
      const orderNumber = between[1] ?? '';

      const afterDate2 = prefix.slice(date2End).trim();
      const afterTokens = afterDate2.split(/\s+/).filter(Boolean);
      const itemCode = afterTokens[0] ?? '';
      const description = afterTokens.slice(1).join(' ');

      lastFullRowData = {
        customer_name: currentCustomerName ?? '',
        po_number: poNumber,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        order_number: orderNumber,
        item_code: itemCode,
        description,
      };
    } else {
      // Continuation row (same invoice, different line item) — reuse header data
      if (!lastFullRowData) continue;
      const tokens = prefix.split(/\s+/).filter(Boolean);
      lastFullRowData.item_code = tokens[0] ?? '';
      lastFullRowData.description = tokens.slice(1).join(' ');
    }

    if (lastFullRowData) {
      results.push({
        ...lastFullRowData,
        customer_name: lastFullRowData.customer_name || null,
        net_amount: netAmount,
        comm_rate: commRate,
        comm_amount: commAmount,
        state: currentSection,
      });
    }
  }

  const rows: HighlightedRow[] = results.map((entry, idx) => ({
    rowNumber: idx + 1,
    cells: {
      Customer: entry.customer_name ?? '',
      PONumber: entry.po_number,
      Invoice: entry.invoice_number,
      InvoiceDate: entry.invoice_date,
      OrderNumber: entry.order_number,
      Item: entry.item_code,
      Description: entry.description,
      NetAmount: entry.net_amount.toFixed(2),
      CommRate: `${entry.comm_rate.toFixed(2)}%`,
      Commission: entry.comm_amount.toFixed(2),
      IsSplit: 'true',
      SplitWith: 'MELESSA REDDITT',
      Region: entry.state ?? '',
    },
    highlight: null,
  }));

  console.log(`[WIT] Extracted ${rows.length} rows from sections ${sectionCodes.join(', ')}`);
  return rows;
}
