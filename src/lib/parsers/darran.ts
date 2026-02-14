import type { FactoryParser } from './types';
import type { CommissionEntry, HighlightedRow } from '@/types/commission';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,%]/g, ''));
  return isNaN(n) ? null : n;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();
  // Try MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}

// DARRAN PDF columns (from analysis):
// Invoice, InvoiceDate, Sales Order, Cust ID, Customer, Inv Amt, Comm Amt, Disc%, Comm%, Rep Amt
export const darranParser: FactoryParser = {
  name: 'DARRAN',
  factoryKey: 'darran',
  format: 'pdf',

  detect(filename: string): boolean {
    return /darran/i.test(filename);
  },

  normalize(rows: HighlightedRow[], ctx): CommissionEntry[] {
    return rows.map((row) => {
      const vals = Object.values(row.cells).map((v) => String(v || ''));

      // Parse the row values based on expected column order
      // Typical order: Invoice#, Date, SalesOrder, CustID, Customer, InvAmt, CommAmt, Disc%, Comm%, RepAmt
      const invoiceNum = vals.find((v) => /^INV\d+/i.test(v)) || vals[0] || null;
      const dateStr = vals.find((v) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) || null;
      const customer = findLongestString(vals);

      // Find dollar amounts (values with $ or large numbers)
      const amounts = vals
        .map((v) => parseNum(v.replace('$', '')))
        .filter((n): n is number => n !== null && Math.abs(n) > 1);

      // Find percentages
      const pcts = vals
        .map((v) => {
          const m = v.match(/([\d.]+)%/);
          return m ? parseFloat(m[1]) / 100 : null;
        })
        .filter((n): n is number => n !== null);

      const salesOrder = vals.find((v) => /^SO\d+/i.test(v)) || null;

      // Amounts: typically [Inv Amt, Comm Amt, Rep Amt] in descending order
      const sortedAmts = [...amounts].sort((a, b) => b - a);
      const invAmt = sortedAmts[0] || null;
      const commAmt = sortedAmts[1] || null;
      const repAmt = sortedAmts[sortedAmts.length - 1] || null;

      const commRate = pcts.find((p) => p < 0.2) || null; // Commission rate is typically < 20%

      return {
        report_id: ctx.reportId,
        factory_id: ctx.factoryId,
        factory_name: 'DARRAN',
        customer_name: customer,
        invoice_number: invoiceNum,
        order_number: salesOrder,
        invoice_date: parseDate(dateStr),
        order_date: null,
        product_category: null,
        item_description: null,
        quantity: null,
        unit_price: null,
        sales_amount: invAmt,
        commission_rate: commRate,
        commission_amount: repAmt, // Rep Amt is Betsy's commission
        region: null,
        is_split: false,
        split_with: null,
        split_amount: null,
        notes: null,
        raw_data: row.cells as Record<string, unknown>,
        row_number: row.rowNumber,
      };
    });
  },
};

function findLongestString(vals: string[]): string | null {
  let longest = '';
  for (const v of vals) {
    if (v.length > longest.length && isNaN(Number(v.replace(/[$,%]/g, ''))) && !v.includes('/')) {
      longest = v;
    }
  }
  return longest || null;
}
