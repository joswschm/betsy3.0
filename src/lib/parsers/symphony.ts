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
      // Concatenate all cell values for pattern matching
      const fullText = Object.values(row.cells).map((v) => String(v || '')).join(' ');

      // Extract using context clues from column labels (like DARRAN approach)
      // Customer name appears before "Customer" label
      const customerMatch = fullText.match(/^(.+?)Customer/);
      const customer = customerMatch ? customerMatch[1].trim() : null;

      // Date appears before "Date" label
      const dateMatch = fullText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})Date/);
      const dateStr = dateMatch ? dateMatch[1] : null;

      // Invoice number appears before "No."
      const invoiceMatch = fullText.match(/(\d{4,6})No\./);
      const invoiceNum = invoiceMatch ? invoiceMatch[1] : null;

      // Ack number appears before "Ack"
      const ackMatch = fullText.match(/(\d{4,6})Ack/);
      const ackNum = ackMatch ? ackMatch[1] : null;

      // Extract dollar amounts (must have decimal point)
      const amountMatches = fullText.match(/[\d,]+\.\d{2}/g) || [];
      const amounts = amountMatches.map((a) => parseNum(a)).filter((n): n is number => n !== null);
      const sortedAmts = [...amounts].sort((a, b) => b - a);

      // Percentage appears before "Rate" or with % sign
      const pctMatch = fullText.match(/(\d{1,3})%/) || fullText.match(/(\d{1,3})Rate/);
      const commRate = pctMatch ? parseFloat(pctMatch[1]) / 100 : null;

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
        order_number: ackNum ? `ACK${ackNum}` : null,
        invoice_date: parseDate(dateStr),
        order_date: null,
        product_category: null,
        item_description: null,
        quantity: null,
        unit_price: null,
        sales_amount: sortedAmts[0] || null,      // Comm Sales (largest decimal amount)
        commission_rate: commRate,
        commission_amount: sortedAmts[1] || null,  // Comm Amt (smallest decimal amount)
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
