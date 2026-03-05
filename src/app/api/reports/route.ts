import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/reports
 * List all uploaded reports with factory name (joined) and entry counts.
 *
 * DB column is "filename" (no underscore) and factory is stored as factory_id.
 * We normalise both before returning so the UI always sees file_name / factory_name.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Join factories so we get the factory name alongside each report
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*, factories(name)')
      .order('id', { ascending: false });

    if (error) throw error;

    // Fetch entry counts in parallel
    const reportsWithCounts = await Promise.all(
      (reports || []).map(async (report) => {
        const { count } = await supabase
          .from('commission_entries')
          .select('*', { count: 'exact', head: true })
          .eq('report_id', report.id);

        // DB stores the filename in the "filename" column (no underscore)
        // and factory as a FK → join gives us report.factories.name
        const factoryRow = report.factories as { name: string } | null;

        return {
          id:             report.id,
          file_name:      (report as Record<string, unknown>).filename as string ?? null,
          factory_name:   factoryRow?.name ?? 'Unknown',
          report_period:  report.report_period,
          entry_count:    count || 0,
        };
      })
    );

    return NextResponse.json(reportsWithCounts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch reports';
    console.error('List reports error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
