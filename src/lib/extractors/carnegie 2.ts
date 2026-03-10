import type { HighlightedRow } from '@/types/commission';

export interface CarnegieExtractionOptions {
  agentName: string; // e.g., "BETSY LINDELL"
}

function parseNum(s: string): number {
  const cleaned = s.replace(/,/g, '').replace(/\(/g, '-').replace(/\)/g, '').replace(/\$/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

type PdfItem = { x: number; y: number; str: string; width: number };

async function extractAllItems(buffer: Buffer): Promise<PdfItem[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { join } = await import('path');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`;

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  const allItems: PdfItem[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    type RawItem = { str: string; transform: number[]; width: number };
    const items = (textContent.items as RawItem[]).filter(
      (item) => item.str && item.str.trim() !== ''
    );
    for (const item of items) {
      allItems.push({
        x: item.transform[4],
        y: item.transform[5],
        str: item.str.trim(),
        width: item.width,
      });
    }
  }

  return allItems;
}

export async function extractCarnegieAgent(
  buffer: Buffer,
  options: CarnegieExtractionOptions
): Promise<HighlightedRow[]> {
  const agentName = options.agentName.toUpperCase();
  const items = await extractAllItems(buffer);

  // Carnegie PDFs use a TRANSPOSED table layout:
  //   x-coordinate = column index  (corresponds to invoice row number in the report)
  //   y-coordinate = row index     (corresponds to field type: Customer, Invoice#, etc.)
  //
  // Each agent's section spans a contiguous range of x-positions.
  // Calibrated y-ranges (from Carnegie Oct PDF debug analysis):
  //   Agent#:       y ≈ 142.8
  //   Total label:  y ≈ 156.6
  //   Agent Name:   y ≈ 160.4
  //   Customer:     y ≈ 241.8
  //   Invoice#:     y ≈ 276.2
  //   Specifier:    y ≈ 382.3
  //   ProductCode:  y ≈ 514.7
  //   Net USD:      y ≈ 648–653  (varies slightly per row)
  //   Comm Value:   y ≈ 652–658  (varies slightly per row)
  //   Comm Rate:    y ≈ 678–681

  // --- Step 1: Locate agent's x-range ---
  const agentNameItem = items.find(
    (item) =>
      item.str.toUpperCase().replace(/\s+/g, ' ').includes(agentName) &&
      !item.str.toUpperCase().includes('TOTAL')
  );

  if (!agentNameItem) {
    console.log(`[Carnegie] Agent "${agentName}" not found in PDF`);
    return [];
  }

  const agentStartX = agentNameItem.x;

  // Find the total marker (e.g. "BETSY LINDELL Total") – it's to the right of the start
  const totalItem = items.find(
    (item) =>
      item.str.toUpperCase().replace(/\s+/g, ' ').includes(agentName) &&
      item.str.toUpperCase().includes('TOTAL') &&
      item.x > agentStartX
  );

  if (!totalItem) {
    console.log(`[Carnegie] Total marker for "${agentName}" not found`);
    return [];
  }

  const agentEndX = totalItem.x;
  console.log(
    `[Carnegie] ${agentName}: x ${agentStartX.toFixed(1)} → ${agentEndX.toFixed(1)}`
  );

  // --- Step 2: Group items into row buckets by x-position ---
  // Row spacing is ~5.3pt; use half-spacing as bucket tolerance
  const X_TOL = 2.7;

  type RowBucket = { centerX: number; items: PdfItem[] };
  const rowBuckets: RowBucket[] = [];

  const scopedItems = items.filter(
    (item) => item.x >= agentStartX - X_TOL && item.x <= agentEndX + X_TOL
  );

  for (const item of scopedItems) {
    const bucket = rowBuckets.find((b) => Math.abs(b.centerX - item.x) <= X_TOL);
    if (bucket) {
      bucket.items.push(item);
    } else {
      rowBuckets.push({ centerX: item.x, items: [item] });
    }
  }

  rowBuckets.sort((a, b) => a.centerX - b.centerX);

  // --- Step 3: Field y-ranges ---
  const Y = {
    customer:    { min: 233, max: 251 },
    invoice:     { min: 268, max: 285 },
    specifier:   { min: 370, max: 395 },
    productCode: { min: 503, max: 527 },
    financial:   { min: 641, max: 671 },  // covers both Net USD and Comm Value
    commRate:    { min: 673, max: 688 },
  };

  function inRange(item: PdfItem, min: number, max: number): boolean {
    return item.y >= min && item.y <= max;
  }

  function getField(bi: PdfItem[], min: number, max: number): string {
    return bi
      .filter((i) => inRange(i, min, max))
      .sort((a, b) => a.x - b.x)
      .map((i) => i.str)
      .join(' ')
      .trim();
  }

  // --- Step 4: Extract data from each row bucket ---
  const allRows: HighlightedRow[] = [];

  for (const { centerX, items: bi } of rowBuckets) {
    // Skip the agent header row (contains agent name text but no financial data)
    if (Math.abs(centerX - agentStartX) <= X_TOL) continue;
    // Skip the total row
    if (Math.abs(centerX - agentEndX) <= X_TOL) continue;
    // Skip any bucket containing a "TOTAL" label
    if (bi.some((i) => i.str.toUpperCase().includes('TOTAL'))) continue;

    // Comm rate is the most reliable indicator that this is a real data row
    const commRateRaw = getField(bi, Y.commRate.min, Y.commRate.max)
      .replace(/%/g, '')
      .trim();
    const commRate = parseFloat(commRateRaw);
    if (isNaN(commRate) || commRate <= 0) continue;

    // Financial items (Net USD and Comm Value are close in y but distinct per row)
    const financialItems = bi
      .filter((i) => inRange(i, Y.financial.min, Y.financial.max))
      .map((i) => ({ y: i.y, val: parseNum(i.str) }))
      .filter((i) => i.val !== 0);

    let netUsd = 0;
    let commValue = 0;

    if (financialItems.length >= 2) {
      // Sort by absolute value descending: Net USD is the larger number,
      // Comm Value is smaller (≈ net * rate/100).
      // Validate with the commission rate relationship.
      const sorted = [...financialItems].sort(
        (a, b) => Math.abs(b.val) - Math.abs(a.val)
      );
      const candidate_net = sorted[0].val;
      const candidate_comm = sorted[sorted.length - 1].val;
      const expectedComm = candidate_net * commRate / 100;
      const tolerance = Math.max(Math.abs(expectedComm) * 0.15, 1);

      if (Math.abs(candidate_comm - expectedComm) <= tolerance) {
        netUsd = candidate_net;
        commValue = candidate_comm;
      } else {
        // Fallback: lower y = Net USD, higher y = Comm Value
        const byY = [...financialItems].sort((a, b) => a.y - b.y);
        netUsd = byY[0].val;
        commValue = byY[byY.length - 1].val;
      }
    } else if (financialItems.length === 1) {
      const v = financialItems[0].val;
      const y = financialItems[0].y;
      // Single value: if y < 655 assume it's Net USD; otherwise Comm Value
      if (y < 655) {
        netUsd = v;
        commValue = v * commRate / 100;
      } else {
        commValue = v;
        netUsd = commRate > 0 ? v / (commRate / 100) : 0;
      }
    }

    if (commValue === 0) continue;

    const customer    = getField(bi, Y.customer.min,    Y.customer.max);
    const invoice     = getField(bi, Y.invoice.min,     Y.invoice.max);
    const specifier   = getField(bi, Y.specifier.min,   Y.specifier.max);
    const productCode = getField(bi, Y.productCode.min, Y.productCode.max);

    allRows.push({
      rowNumber: allRows.length + 1,
      cells: {
        Col1: invoice || `x=${centerX.toFixed(1)}`,
        Customer: customer,
        Invoice: invoice,
        Specifier: specifier,
        ProductCode: productCode,
        ProjectName: '',
        NetSales: netUsd.toFixed(2),
        CommRate: `${commRate}%`,
        Commission: commValue.toFixed(2),
      },
    });
  }

  console.log(`[Carnegie] Extracted ${allRows.length} rows for ${agentName}`);
  return allRows;
}
