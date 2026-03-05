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
      // Concatenate all cell values into one string for pattern matching
      const fullText = Object.values(row.cells).map((v) => String(v || '')).join(' ');

      // Extract specific values using regex .match() to get the actual matched portion
      const invoiceMatch = fullText.match(/INV\d+/i);
      const invoiceNum = invoiceMatch ? invoiceMatch[0] : null;

      const dateMatch = fullText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const dateStr = dateMatch ? dateMatch[1] : null;

      const salesOrderMatch = fullText.match(/SO\d+/i);
      const salesOrder = salesOrderMatch ? salesOrderMatch[0] : null;

      // Extract customer name (text between cust ID and first dollar sign)
      // Pattern: after 6-digit number, before first $
      const customerMatch = fullText.match(/\d{6}\s+([A-Z\s\-&]+?)\s+\$/);
      const customer = customerMatch ? customerMatch[1].trim() : null;

      // Extract all dollar amounts
      const amountMatches = fullText.match(/\$[\d,]+\.?\d*/g) || [];
      const amounts = amountMatches.map((a) => parseNum(a)).filter((n): n is number => n !== null);

      // Extract percentages
      const pctMatches = fullText.match(/([\d.]+)%/g) || [];
      const pcts = pctMatches.map((p) => parseFloat(p) / 100);

      // Amounts in DARRAN: Inv Amt (largest), Comm Amt (2nd), Rep Amt (smallest)
      const sortedAmts = [...amounts].sort((a, b) => b - a);
      const invAmt = sortedAmts[0] || null;
      const commAmt = sortedAmts[1] || null;
      const repAmt = sortedAmts[2] || null;

      const commRate = pcts.find((p) => p < 0.2) || null;

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
