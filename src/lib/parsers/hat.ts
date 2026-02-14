import type { FactoryParser } from './types';
import type { CommissionEntry, HighlightedRow } from '@/types/commission';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    // Try ISO date
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

export const hatParser: FactoryParser = {
  name: 'HAT Commissions',
  factoryKey: 'hat',
  format: 'excel',
  sheetNameHint: 'YTD SALES DETAIL',

  detect(filename: string, headers?: string[]): boolean {
    const fnMatch = /hat/i.test(filename) && /commission/i.test(filename);
    const headerMatch = headers
      ? headers.some((h) => h.includes('BETSY')) && headers.some((h) => h.includes('Product Category'))
      : false;
    return fnMatch || headerMatch;
  },

  normalize(rows: HighlightedRow[], ctx): CommissionEntry[] {
    return rows.map((row) => {
      const c = row.cells;
      // HAT column mapping (based on actual file analysis):
      // Columns shift due to merged headers — use the keys we found
      return {
        report_id: ctx.reportId,
        factory_id: ctx.factoryId,
        factory_name: 'HAT',
        customer_name: findVal(c, ['CustName', 'Customer']) as string | null,
        invoice_number: findVal(c, ['CO Num', 'CO Number']) as string | null,
        order_number: findVal(c, ['Cust PO']) as string | null,
        invoice_date: parseDate(findVal(c, ['Invoice Date'])),
        order_date: parseDate(findVal(c, ['Order Date'])),
        product_category: findVal(c, ['Product Category']) as string | null,
        item_description: findVal(c, ['Item Description']) as string | null,
        quantity: parseNum(findVal(c, ['Qty Shipped'])),
        unit_price: parseNum(findVal(c, ['Unit Price'])),
        sales_amount: parseNum(findVal(c, ['Payment', 'Total Price'])),
        commission_rate: parseNum(findVal(c, ['Commission', 'Order Discount%'])),
        commission_amount: parseNum(findVal(c, ['BETSY OCT', 'BETSY NOV', 'BETSY DEC', 'BETSY JAN', 'BETSY FEB', 'BETSY MAR', 'BETSY APR', 'BETSY MAY', 'BETSY JUN', 'BETSY JUL', 'BETSY AUG', 'BETSY SEP'])),
        region: findVal(c, ['Sub Rep']) as string | null,
        is_split: false,
        split_with: null,
        split_amount: null,
        notes: null,
        raw_data: c as Record<string, unknown>,
        row_number: row.rowNumber,
      };
    });
  },
};

function findVal(cells: Record<string, string | number | null>, keys: string[]): string | number | null {
  for (const key of keys) {
    // Exact match
    if (key in cells && cells[key] != null) return cells[key];
    // Partial match
    const found = Object.keys(cells).find((k) => k.toLowerCase().includes(key.toLowerCase()));
    if (found && cells[found] != null) return cells[found];
  }
  return null;
}
