import type { FactoryParser } from './types';
import type { CommissionEntry, HighlightedRow } from '@/types/commission';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

// MG report has summary rows ("Customer Total", "Salesperson Total") that we should skip
function isSummaryRow(cells: Record<string, string | number | null>): boolean {
  const vals = Object.values(cells).map((v) => String(v || '').toLowerCase());
  return vals.some((v) => v.includes('customer total') || v.includes('salesperson total'));
}

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

      // MG columns (from analysis): Rep#, Split, CustomerID, CustomerName,
      // SO/LO/PO#, Invoice#, CommRate, (various amount columns)
      const vals = Object.values(c).filter((v) => v !== null);
      const keys = Object.keys(c);

      // Find the customer name (usually the longest text field)
      const customerName = findLongestString(c);

      // Find numeric values for amounts
      const nums = vals
        .map((v) => parseNum(v))
        .filter((n): n is number => n !== null && n > 1);

      // Commission rate is usually 10 (meaning 10%)
      const rateVal = vals.find((v) => parseNum(v) === 10);
      const commRate = rateVal ? 0.1 : null;

      // Sales amount is typically the largest number, commission is the second
      const sortedNums = [...nums].sort((a, b) => b - a);

      entries.push({
        report_id: ctx.reportId,
        factory_id: ctx.factoryId,
        factory_name: 'MG',
        customer_name: customerName,
        invoice_number: findInvoiceNumber(c),
        order_number: findOrderNumber(c),
        invoice_date: null,
        order_date: null,
        product_category: null,
        item_description: null,
        quantity: null,
        unit_price: null,
        sales_amount: sortedNums[0] || null,
        commission_rate: commRate,
        commission_amount: sortedNums.length > 1 ? sortedNums[1] : null,
        region: null,
        is_split: false,
        split_with: null,
        split_amount: null,
        notes: findVal(c, 'WIT Contract') ? 'WIT Contract' : null,
        raw_data: c as Record<string, unknown>,
        row_number: row.rowNumber,
      });
    }

    return entries;
  },
};

function findLongestString(cells: Record<string, string | number | null>): string | null {
  let longest = '';
  for (const val of Object.values(cells)) {
    const s = String(val || '');
    if (s.length > longest.length && isNaN(Number(s)) && !s.includes('=')) {
      longest = s;
    }
  }
  return longest || null;
}

function findVal(cells: Record<string, string | number | null>, search: string): boolean {
  return Object.values(cells).some((v) => String(v || '').includes(search));
}

function findInvoiceNumber(cells: Record<string, string | number | null>): string | null {
  for (const [key, val] of Object.entries(cells)) {
    const s = String(val || '');
    if (/^IN\d+/i.test(s) || /invoice/i.test(key)) return s;
  }
  return null;
}

function findOrderNumber(cells: Record<string, string | number | null>): string | null {
  for (const [key, val] of Object.entries(cells)) {
    const s = String(val || '');
    if (/^(SO|LO|RP)\d+/i.test(s)) return s;
  }
  return null;
}
