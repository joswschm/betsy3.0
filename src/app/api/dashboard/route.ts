import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period');

    // Get all entries, optionally filtered by period via reports
    let entryQuery = supabase.from('commission_entries').select('*');

    if (period) {
      const { data: reports } = await supabase
        .from('reports')
        .select('id')
        .ilike('report_period', `%${period}%`);

      if (reports && reports.length > 0) {
        entryQuery = entryQuery.in('report_id', reports.map((r) => r.id));
      } else {
        // No reports for this period
        return NextResponse.json({
          total_sales: 0,
          total_commission: 0,
          entry_count: 0,
          report_count: 0,
          by_factory: [],
          by_customer: [],
          entries: [],
        });
      }
    }

    const { data: entries, error } = await entryQuery.order('created_at', { ascending: false });
    if (error) throw error;

    // Get report count
    let reportQuery = supabase.from('reports').select('*', { count: 'exact' });
    if (period) {
      reportQuery = reportQuery.ilike('report_period', `%${period}%`);
    }
    const { count: reportCount } = await reportQuery;

    // Compute aggregates
    const totalSales = (entries || []).reduce((sum, e) => sum + (e.sales_amount || 0), 0);
    const totalCommission = (entries || []).reduce((sum, e) => sum + (e.commission_amount || 0), 0);

    // By factory
    const factoryMap: Record<string, { sales: number; commission: number; count: number }> = {};
    for (const e of entries || []) {
      const key = e.factory_name;
      if (!factoryMap[key]) factoryMap[key] = { sales: 0, commission: 0, count: 0 };
      factoryMap[key].sales += e.sales_amount || 0;
      factoryMap[key].commission += e.commission_amount || 0;
      factoryMap[key].count++;
    }

    // By customer
    const custMap: Record<string, { sales: number; commission: number; count: number }> = {};
    for (const e of entries || []) {
      const key = e.customer_name || 'Unknown';
      if (!custMap[key]) custMap[key] = { sales: 0, commission: 0, count: 0 };
      custMap[key].sales += e.sales_amount || 0;
      custMap[key].commission += e.commission_amount || 0;
      custMap[key].count++;
    }

    return NextResponse.json({
      total_sales: totalSales,
      total_commission: totalCommission,
      entry_count: (entries || []).length,
      report_count: reportCount || 0,
      by_factory: Object.entries(factoryMap)
        .map(([factory_name, data]) => ({ factory_name, ...data }))
        .sort((a, b) => b.sales - a.sales),
      by_customer: Object.entries(custMap)
        .map(([customer_name, data]) => ({ customer_name, ...data }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 20),
      entries: (entries || []).slice(0, 50).map((e) => ({
        id: e.id,
        factory_name: e.factory_name,
        customer_name: e.customer_name,
        invoice_number: e.invoice_number,
        invoice_date: e.invoice_date,
        sales_amount: e.sales_amount,
        commission_amount: e.commission_amount,
        commission_rate: e.commission_rate,
        is_split: e.is_split,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dashboard query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
