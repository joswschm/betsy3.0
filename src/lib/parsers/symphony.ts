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
  // MM/DD/YY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  // MM/DD/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  return null;
}

// SYMPHONY PDF columns (from analysis):
// Customer, Date, Invoice No., Ack No, Comm Sales, Comm Rate, Comm Amt
export const symphonyParser: FactoryParser = {
  name: 'SYMPHONY',
  factoryKey: 'symphony',
  format: 'pdf',

  detect(filename: string): boolean {
    return /symphony/i.test(filename);
  },

  normalize(rows: HighlightedRow[], ctx): CommissionEntry[] {
    const entries: CommissionEntry[] = [];

    for (const row of rows) {
      const vals = Object.values(row.cells).map((v) => String(v || ''));

      // Find customer name (longest non-numeric string)
      const customer = findCustomerName(vals);
      const dateStr = vals.find((v) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) || null;
      const invoiceNum = vals.find((v) => /^\d{4,6}$/.test(v)) || null;

      // Find amounts
      const amounts = vals
        .map((v) => parseNum(v))
        .filter((n): n is number => n !== null && Math.abs(n) > 1);
      const sortedAmts = [...amounts].sort((a, b) => b - a);

      // Find percentage (comm rate)
      const pctStr = vals.find((v) => /^\d{1,3}%$/.test(v));
      const commRate = pctStr ? parseFloat(pctStr) / 100 : null;

      // Check for split info from sticky notes
      let isSplit = false;
      let splitWith: string | null = null;
      let splitAmount: number | null = null;
      let notes: string | null = null;

      if (ctx.stickyNotes) {
        for (const note of ctx.stickyNotes) {
          const splitMatch = note.text.match(/split with (\w+)/i);
          if (splitMatch) {
            isSplit = true;
            splitWith = splitMatch[1];
            const amtMatch = note.text.match(/([\d,]+\.?\d*)\s*\(split/i) ||
                             note.text.match(/([\d,]+\.?\d*)/);
            if (amtMatch) splitAmount = parseNum(amtMatch[1]);
            notes = note.text;
          }
        }
      }

      entries.push({
        report_id: ctx.reportId,
        factory_id: ctx.factoryId,
        factory_name: 'SYMPHONY',
        customer_name: customer,
        invoice_number: invoiceNum,
        order_number: null,
        invoice_date: parseDate(dateStr),
        order_date: null,
        product_category: null,
        item_description: null,
        quantity: null,
        unit_price: null,
        sales_amount: sortedAmts[0] || null,      // Comm Sales (largest amount)
        commission_rate: commRate,
        commission_amount: sortedAmts[1] || null,  // Comm Amt (second largest)
        region: null,
        is_split: isSplit,
        split_with: splitWith,
        split_amount: splitAmount,
        notes: notes,
        raw_data: row.cells as Record<string, unknown>,
        row_number: row.rowNumber,
      });
    }

    return entries;
  },
};

function findCustomerName(vals: string[]): string | null {
  let longest = '';
  for (const v of vals) {
    const cleaned = v.replace(/[$,%]/g, '');
    if (v.length > longest.length && isNaN(Number(cleaned)) && !/^\d{1,2}\//.test(v)) {
      longest = v;
    }
  }
  return longest || null;
}
