import type { FactoryParser } from './types';
import type { CommissionEntry, HighlightedRow } from '@/types/commission';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/[$,()]/g, '').trim();
  // Handle negative numbers in parentheses
  const isNegative = String(val).includes('(');
  const n = parseFloat(str);
  return isNaN(n) ? null : isNegative ? -Math.abs(n) : n;
}

// Carnegie PDF structure: Agent sections with line items extracted by carnegie.ts
// The extractor provides structured cells: Customer, Invoice, Specifier, ProductCode, ProjectName, NetSales, CommRate, Commission
export const carnegieParser: FactoryParser = {
  name: 'Carnegie',
  factoryKey: 'carnegie',
  format: 'pdf',

  detect(filename: string): boolean {
    return /carnegie/i.test(filename);
  },

  normalize(rows: HighlightedRow[], ctx): CommissionEntry[] {
    const entries: CommissionEntry[] = [];

    for (const row of rows) {
      const cells = row.cells;

      // Skip the total line
      if (cells.Customer === 'TOTAL') {
        console.log('Skipping total line');
        continue;
      }

      // Extract values from structured cells
      const customerName = cells.Customer ? String(cells.Customer).trim() : null;
      const invoiceNumber = cells.Invoice ? String(cells.Invoice).trim() : null;
      const specifier = cells.Specifier ? String(cells.Specifier).trim() : null;
      const productCode = cells.ProductCode ? String(cells.ProductCode).trim() : null;
      const projectName = cells.ProjectName ? String(cells.ProjectName).trim() : null;
      const netSales = parseNum(cells.NetSales);
      const commission = parseNum(cells.Commission);

      // Extract commission rate
      const commRateStr = cells.CommRate ? String(cells.CommRate) : null;
      const commRate = commRateStr ? parseFloat(commRateStr.replace('%', '')) / 100 : null;

      console.log(`Carnegie row ${row.rowNumber}: ${customerName || '(continuation)'} | ${invoiceNumber || ''} | Sales: $${netSales} | Comm: $${commission}`);

      entries.push({
        report_id: ctx.reportId,
        factory_id: ctx.factoryId,
        factory_name: 'Carnegie',
        customer_name: customerName,
        invoice_number: invoiceNumber,
        order_number: productCode,
        invoice_date: null, // Carnegie doesn't show dates in detail rows
        order_date: null,
        product_category: specifier,
        item_description: projectName,
        quantity: null,
        unit_price: null,
        sales_amount: netSales,
        commission_rate: commRate,
        commission_amount: commission,
        region: null,
        is_split: false,
        split_with: null,
        split_amount: null,
        notes: null,
        raw_data: row.cells as Record<string, unknown>,
        row_number: row.rowNumber,
      });
    }

    console.log(`Carnegie parser: normalized ${entries.length} entries`);
    return entries;
  },
};
