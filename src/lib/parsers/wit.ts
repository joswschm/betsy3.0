import type { FactoryParser } from './types';
import type { CommissionEntry, HighlightedRow } from '@/types/commission';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/[$,()]/g, '').trim();
  const isNegative = String(val).includes('(');
  const n = parseFloat(str);
  return isNaN(n) ? null : isNegative ? -Math.abs(n) : n;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();

  // Handle YYYY-MM-DD format (already ISO) — from WIT extractor
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // Handle MM/DD/YYYY format
  const match = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    let year = match[3];
    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }

  return null;
}

// WIT PDF structure: Sales rep sections with detailed line items
// The extractor provides structured cells: Customer, Invoice, InvoiceDate, Item, Description, NetAmount, CommRate, Commission, Region
export const witParser: FactoryParser = {
  name: 'WIT (Artopex)',
  factoryKey: 'wit',
  format: 'pdf',

  detect(filename: string): boolean {
    return /wit/i.test(filename);
  },

  normalize(rows: HighlightedRow[], ctx): CommissionEntry[] {
    const entries: CommissionEntry[] = [];

    for (const row of rows) {
      const cells = row.cells;

      // Extract values from structured cells
      const customerName = cells.Customer ? String(cells.Customer).trim() : null;
      const invoiceNumber = cells.Invoice ? String(cells.Invoice).trim() : null;
      const invoiceDate = parseDate(cells.InvoiceDate);
      const item = cells.Item ? String(cells.Item).trim() : null;
      const description = cells.Description ? String(cells.Description).trim() : null;
      const netAmount = parseNum(cells.NetAmount);
      const commission = parseNum(cells.Commission);
      const region = cells.Region ? String(cells.Region).trim() : null;

      // Extract commission rate
      const commRateStr = cells.CommRate ? String(cells.CommRate) : null;
      const commRate = commRateStr ? parseFloat(commRateStr.replace('%', '')) / 100 : null;

      console.log(`WIT row ${row.rowNumber}: ${customerName || '(detail)'} | ${invoiceNumber || ''} | Region: ${region} | Sales: $${netAmount} | Comm: $${commission}`);

      entries.push({
        report_id: ctx.reportId,
        factory_id: ctx.factoryId,
        factory_name: 'Artopex',
        customer_name: customerName,
        invoice_number: invoiceNumber,
        order_number: item, // Use item code as order number
        invoice_date: invoiceDate,
        order_date: null,
        product_category: null,
        item_description: description,
        quantity: null,
        unit_price: null,
        sales_amount: netAmount,
        commission_rate: commRate,
        commission_amount: commission,
        region: region, // AL or TN
        is_split: true, // Betsy + Melessa shared commissions
        split_with: 'MELESSA REDDITT',
        split_amount: null, // Full amount shown, but it's split 50/50 (can be calculated later)
        notes: 'Shared commission with Melessa',
        raw_data: row.cells as Record<string, unknown>,
        row_number: row.rowNumber,
      });
    }

    console.log(`WIT parser: normalized ${entries.length} entries`);
    return entries;
  },
};
