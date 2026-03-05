import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/reports/[id]
 * Hard-deletes a report and all associated commission entries.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const reportId = params.id;

    // Delete commission entries first (FK constraint)
    const { error: entriesError } = await supabase
      .from('commission_entries')
      .delete()
      .eq('report_id', reportId);

    if (entriesError) throw new Error(`Failed to delete entries: ${entriesError.message}`);

    // Delete the report itself
    const { error: reportError } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (reportError) throw new Error(`Failed to delete report: ${reportError.message}`);

    return NextResponse.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete report';
    console.error('Delete report error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/reports/[id]
 * Reclassify a report to a different month/period.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { report_period } = body;

    if (!report_period || typeof report_period !== 'string') {
      return NextResponse.json({ error: 'report_period is required' }, { status: 400 });
    }

    const normalised = report_period.trim().toUpperCase();

    const { error } = await supabase
      .from('reports')
      .update({ report_period: normalised })
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, report_period: normalised });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update report';
    console.error('Update report error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/reports/[id]
 * Get details about a specific report.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const reportId = params.id;

    const { data: report, error } = await supabase
      .from('reports')
      .select('*, factories(name)')
      .eq('id', reportId)
      .single();

    if (error) throw error;

    const { count } = await supabase
      .from('commission_entries')
      .select('*', { count: 'exact', head: true })
      .eq('report_id', reportId);

    const factoryRow = report.factories as { name: string } | null;

    return NextResponse.json({
      id:            report.id,
      file_name:     (report as Record<string, unknown>).filename as string ?? null,
      factory_name:  factoryRow?.name ?? 'Unknown',
      report_period: report.report_period,
      entry_count:   count || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
