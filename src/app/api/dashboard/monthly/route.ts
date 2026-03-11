import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/dashboard/monthly
 * Returns monthly aggregated data with factory breakdowns and line items
 *
 * Query params:
 * - month: YYYY-MM format (e.g., "2025-10") - if provided, returns data for that month only
 *
 * Response structure:
 * {
 *   all_time: { total_sales, total_commission },
 *   available_months: ["2025-11", "2025-10", ...], // sorted desc
 *   monthly_data: {
 *     "2025-10": {
 *       month_sales, month_commission,
 *       factories: [{
 *         factory_name, sales, commission,
 *         entries: [{ customer_name, invoice_number, item_code, sales_amount, commission_amount, ... }]
 *       }]
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const selectedMonth = request.nextUrl.searchParams.get('month');

    // Get all entries with their report info
    const { data: entries, error } = await supabase
      .from('commission_entries')
      .select(`
        *,
        reports!inner(id, report_period)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate all-time totals
    const allTimeSales = (entries || []).reduce((sum, e) => sum + (e.sales_amount || 0), 0);
    const allTimeCommission = (entries || []).reduce((sum, e) => sum + (e.commission_amount || 0), 0);

    // Group entries by month (extract from report_period or created_at)
    const monthlyMap: Record<string, any[]> = {};
    const monthsSet = new Set<string>();

    for (const entry of entries || []) {
      // Extract month from report_period (e.g., "OCT 2025" -> "2025-10")
      // or fall back to created_at
      let monthKey: string;
      const report = (entry as any).reports;

      if (report && report.report_period) {
        // Parse "OCT 2025" or "October 2025" format
        const match = report.report_period.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i);
        if (match) {
          const monthNames: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04',
            may: '05', jun: '06', jul: '07', aug: '08',
            sep: '09', oct: '10', nov: '11', dec: '12'
          };
          const monthNum = monthNames[match[1].toLowerCase()];
          const year = match[2];
          monthKey = `${year}-${monthNum}`;
        } else {
          // Fallback to entry created_at
          monthKey = entry.created_at.substring(0, 7); // "2025-10"
        }
      } else {
        monthKey = entry.created_at.substring(0, 7);
      }

      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = [];
      monthlyMap[monthKey].push(entry);
      monthsSet.add(monthKey);
    }

    // Sort months descending
    const availableMonths = Array.from(monthsSet).sort().reverse();

    // Build monthly data
    const monthlyData: Record<string, any> = {};

    // If specific month requested, only process that one
    const monthsToProcess = selectedMonth && monthsSet.has(selectedMonth)
      ? [selectedMonth]
      : availableMonths;

    for (const monthKey of monthsToProcess) {
      const monthEntries = monthlyMap[monthKey] || [];

      const monthSales = monthEntries.reduce((sum, e) => sum + (e.sales_amount || 0), 0);
      const monthCommission = monthEntries.reduce((sum, e) => sum + (e.commission_amount || 0), 0);

      // Group by factory
      const factoryMap: Record<string, any[]> = {};
      for (const entry of monthEntries) {
        const factoryName = entry.factory_name;
        if (!factoryMap[factoryName]) factoryMap[factoryName] = [];
        factoryMap[factoryName].push(entry);
      }

      // Build factory summaries with entries
      const factories = Object.entries(factoryMap).map(([factoryName, factoryEntries]) => {
        const factorySales = factoryEntries.reduce((sum, e) => sum + (e.sales_amount || 0), 0);
        const factoryCommission = factoryEntries.reduce((sum, e) => sum + (e.commission_amount || 0), 0);

        return {
          factory_name: factoryName,
          sales: factorySales,
          commission: factoryCommission,
          entry_count: factoryEntries.length,
          entries: factoryEntries.map(e => ({
            id: e.id,
            customer_name: e.customer_name,
            invoice_number: e.invoice_number,
            invoice_date: e.invoice_date,
            item_code: e.item_code,
            description: e.description,
            sales_amount: e.sales_amount,
            commission_amount: e.commission_amount,
            commission_rate: e.commission_rate,
            is_split: e.is_split,
            split_with: e.split_with,
            region: e.region,
          }))
        };
      }).sort((a, b) => b.sales - a.sales);

      monthlyData[monthKey] = {
        month_sales: monthSales,
        month_commission: monthCommission,
        factories
      };
    }

    return NextResponse.json({
      all_time: {
        total_sales: allTimeSales,
        total_commission: allTimeCommission
      },
      available_months: availableMonths,
      monthly_data: monthlyData
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Monthly dashboard query failed';
    console.error('Monthly dashboard error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
