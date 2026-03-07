import type { FactoryParser } from './types';
import type { CommissionEntry, HighlightedRow } from '@/types/commission';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

// MG report has summary rows ("Customer Total", "Salesperson Total") that we should skip
function isSummaryRow(cells: Record<string, string | number | null>): boolean {
  const vals = Object.values(cells).map((v) => String(v || '').toLowerCase().trim());
  return vals.some((v) =>
    v.includes('customer total') ||
    v.includes('salesperson total') ||
    v.includes('cust total') ||
    v.includes('grand total') ||
    v === 'total'
  );
}

// MG File Column Layout (headers in row 6):
//   Col1: Salesperson (#)          — e.g. 49
//   Col2: Salesperson Name         — e.g. "WIT Contract"
//   Col3: Customer (ID)            — e.g. "AIC010"
//   Col4: Customer Name            — e.g. "AI CORPORATE INTERIORS LLC"
//   Col5: End User                 — e.g. "REDSTONE ARSENAL"
//   Col6: Order Number             — SO/LO/RP/CU prefix
//   Col7: Invoice Number           — IN prefix
//   Col8: Comm %                   — e.g. 10
//   Col9: Split %
//   Col10: Invoice Date
//   Col11: Comm Amt                — COMMISSION AMOUNT
//   Col12: Sales Amt               — SALES AMOUNT

export const mgParser: FactoryParser = {
  name: 'MG Commission Report',
  factoryKey: 'mg',
  format: 'excel',

  detect(filename: string): boolean {
    return /mg/i.test(filename) && /commission/i.test(filename);
  },

  normalize(rows: HighlightedRow[], ctx): CommissionEntry[] {
    const entries: CommissionEntry[] = [];

    for (const row of rows) {
      const c = row.cells;

      // Skip summary/total rows
      if (isSummaryRow(c)) continue;

      // Map columns by header name
      const customerName = findVal(c, ['Customer Name']);

      const customerId = findVal(c, ['Customer']);
      const endUser = findVal(c, ['End User']);
      const orderNumber = findVal(c, ['Order Number']);
      const invoiceNumber = findVal(c, ['Invoice Number']);

      // Safety net: skip rows with no invoice number (customer total rows have a customer name
      // but no invoice number, and would otherwise duplicate the preceding sale row)
      if (!invoiceNumber) continue;
      const invoiceDate = parseDate(findVal(c, ['Invoice Date']));
      const commPct = parseNum(findVal(c, ['Comm %']));
      const commAmt = parseNum(findVal(c, ['Comm Amt']));
      const salesAmt = parseNum(findVal(c, ['Sales Amt']));
      const salespersonName = findVal(c, ['Salesperson Name']);
      const splitPct = parseNum(findVal(c, ['Split %']));

      entries.push({
        report_id: ctx.reportId,
        factory_id: ctx.factoryId,
        factory_name: 'MG',
        customer_name: customerName ? String(customerName) : null,
        invoice_number: invoiceNumber ? String(invoiceNumber) : null,
        order_number: orderNumber ? String(orderNumber) : null,
        invoice_date: invoiceDate,
        order_date: null,
        product_category: null,
        item_description: endUser ? `End User: ${endUser}` : null,
        quantity: null,
        unit_price: null,
        sales_amount: salesAmt,
        commission_rate: commPct != null ? commPct / 100 : null, // 10 -> 0.10
        commission_amount: commAmt,
        region: null,
        is_split: splitPct != null && splitPct > 0,
        split_with: null,
        split_amount: null,
        notes: salespersonName ? `Contract: ${salespersonName}` : null,
        raw_data: {
          ...(c as Record<string, unknown>),
          customer_id: customerId,
        },
        row_number: row.rowNumber,
      });
    }

    return entries;
  },
};

/** Find a value in cells by trying multiple possible header names */
function findVal(
  cells: Record<string, string | number | null>,
  keys: string[]
): string | number | null {
  for (const key of keys) {
    // Exact match first
    if (key in cells && cells[key] != null) return cells[key];
    // Case-insensitive match
    const found = Object.keys(cells).find(
      (k) => k.toLowerCase().trim() === key.toLowerCase().trim()
    );
    if (found && cells[found] != null) return cells[found];
    // Partial match (header contains the key)
    const partial = Object.keys(cells).find(
      (k) => k.toLowerCase().trim().includes(key.toLowerCase().trim())
    );
    if (partial && cells[partial] != null) return cells[partial];
  }
  return null;
}