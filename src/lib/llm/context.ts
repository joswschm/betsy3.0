import { supabase } from '@/lib/supabase';

export async function buildDataContext(period?: string): Promise<string> {
  // Get all commission entries, optionally filtered by period
  // Period formats: "2025-10" (month), "2025" (year), undefined (all-time)
  let query = supabase
    .from('commission_entries')
    .select('*')
    .order('invoice_date', { ascending: false });

  if (period) {
    // Get reports that match the period
    const { data: reports } = await supabase
      .from('reports')
      .select('id, report_period');

    if (reports && reports.length > 0) {
      let filteredReportIds: string[] = [];

      if (period.includes('-')) {
        // Month format: "2025-10" -> match "OCT 2025"
        const [year, month] = period.split('-');
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const monthName = monthNames[parseInt(month) - 1];

        filteredReportIds = reports
          .filter(r => r.report_period?.includes(monthName) && r.report_period?.includes(year))
          .map(r => r.id);
      } else if (period.length === 4) {
        // Year format: "2025" -> match any report with "2025"
        filteredReportIds = reports
          .filter(r => r.report_period?.includes(period))
          .map(r => r.id);
      }

      if (filteredReportIds.length > 0) {
        query = query.in('report_id', filteredReportIds);
      }
    }
  }

  const { data: entries, error } = await query.limit(200);
  if (error) throw error;
  if (!entries || entries.length === 0) {
    return 'No commission data available yet. Please upload some reports first.';
  }

  // Compute summary stats
  const totalSales = entries.reduce((sum, e) => sum + (e.sales_amount || 0), 0);
  const totalCommission = entries.reduce((sum, e) => sum + (e.commission_amount || 0), 0);

  // Group by factory
  const byFactory: Record<string, { sales: number; commission: number; count: number }> = {};
  for (const e of entries) {
    const key = e.factory_name;
    if (!byFactory[key]) byFactory[key] = { sales: 0, commission: 0, count: 0 };
    byFactory[key].sales += e.sales_amount || 0;
    byFactory[key].commission += e.commission_amount || 0;
    byFactory[key].count++;
  }

  // Group by customer
  const byCustomer: Record<string, { sales: number; commission: number; count: number }> = {};
  for (const e of entries) {
    const key = e.customer_name || 'Unknown';
    if (!byCustomer[key]) byCustomer[key] = { sales: 0, commission: 0, count: 0 };
    byCustomer[key].sales += e.sales_amount || 0;
    byCustomer[key].commission += e.commission_amount || 0;
    byCustomer[key].count++;
  }
  const topCustomers = Object.entries(byCustomer)
    .sort(([, a], [, b]) => b.sales - a.sales)
    .slice(0, 15);

  // Build context string
  let ctx = `=== COMMISSION DATA SUMMARY ===\n`;
  ctx += `Period: ${period || 'All Time'}\n`;
  ctx += `Total Entries: ${entries.length}\n`;
  ctx += `Total Sales: $${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  ctx += `Total Commission: $${totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n`;

  ctx += `--- By Factory ---\n`;
  for (const [name, data] of Object.entries(byFactory)) {
    ctx += `${name}: $${data.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })} sales, $${data.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })} commission (${data.count} entries)\n`;
  }

  ctx += `\n--- Top Customers ---\n`;
  for (const [name, data] of topCustomers) {
    ctx += `${name}: $${data.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })} sales, $${data.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })} commission (${data.count} entries)\n`;
  }

  ctx += `\n--- Individual Entries ---\n`;
  for (const e of entries.slice(0, 50)) {
    ctx += `[${e.factory_name}] ${e.customer_name || 'N/A'} | Invoice: ${e.invoice_number || 'N/A'} | Date: ${e.invoice_date || 'N/A'} | Sales: $${(e.sales_amount || 0).toFixed(2)} | Commission: $${(e.commission_amount || 0).toFixed(2)}`;
    if (e.is_split) ctx += ` | SPLIT with ${e.split_with}`;
    ctx += `\n`;
  }

  return ctx;
}
