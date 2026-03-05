import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractHighlightedRowsFromExcel } from '@/lib/extractors/excel';
import { extractHighlightedRowsFromPDF } from '@/lib/extractors/pdf';
import { extractCarnegieAgent } from '@/lib/extractors/carnegie';
import { getParserByKey, autoDetectParser } from '@/lib/parsers/registry';
import { extractWITSections } from '@/lib/extractors/wit';
import * as fs from 'fs';

export const maxDuration = 60; // Allow up to 60s for processing

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const factoryKey = formData.get('factory') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const isExcel = /\.xlsx?$/i.test(filename);
    const isPDF = /\.pdf$/i.test(filename);

    if (!isExcel && !isPDF) {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload .xlsx or .pdf files.' },
        { status: 400 }
      );
    }

    // Find the parser
    let parser = factoryKey ? getParserByKey(factoryKey) : null;
    if (!parser) {
      parser = autoDetectParser(filename);
    }
    if (!parser) {
      return NextResponse.json(
        { error: `Could not detect factory for "${filename}". Please select the factory manually.` },
        { status: 400 }
      );
    }

    // Get factory record from DB
    const { data: factory } = await supabase
      .from('factories')
      .select('*')
      .eq('name', parser.factoryKey)
      .single();

    if (!factory) {
      return NextResponse.json(
        { error: `Factory "${parser.factoryKey}" not found in database.` },
        { status: 400 }
      );
    }

    // Create report record
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        factory_id: factory.id,
        filename,
        report_period: extractPeriodFromFilename(filename),
        status: 'processing',
      })
      .select()
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 });
    }

    try {
      // Extract rows (highlighted or agent-specific)
      let highlightedRows;
      let stickyNotes: { text: string; rect: number[] }[] = [];

      // Write debug info to file (bypasses Next.js console suppression)
      const debugLine = `factoryKey=${parser.factoryKey} isExcel=${isExcel} isPDF=${isPDF} filename=${filename}\n`;
      fs.writeFileSync('/tmp/wit_debug.txt', debugLine);
      process.stdout.write('[UPLOAD] ' + debugLine);

      if (parser.factoryKey === 'carnegie' && isPDF) {
        highlightedRows = await extractCarnegieAgent(buffer, { agentName: 'BETSY LINDELL' });
      } else if (parser.factoryKey === 'wit' && isPDF) {
        fs.appendFileSync('/tmp/wit_debug.txt', 'Entering WIT branch\n');
        highlightedRows = await extractWITSections(buffer, { sectionCodes: ['5651', '5652'] });
        fs.appendFileSync('/tmp/wit_debug.txt', `WIT rows returned: ${highlightedRows.length}\n`);
      } else if (isExcel) {
        const result = await extractHighlightedRowsFromExcel(buffer, parser.sheetNameHint);
        highlightedRows = result.rows;
      } else {
        fs.appendFileSync('/tmp/wit_debug.txt', 'Entering ELSE branch (not WIT)\n');
        const result = await extractHighlightedRowsFromPDF(buffer);
        highlightedRows = result.rows;
        stickyNotes = result.stickyNotes;
      }

      if (highlightedRows.length === 0) {
        await supabase
          .from('reports')
          .update({ status: 'completed', extracted_row_count: 0, processed_at: new Date().toISOString() })
          .eq('id', report.id);

        return NextResponse.json({
          report_id: report.id,
          factory: parser.name,
          extracted_count: 0,
          message: 'No highlighted rows found in the file.',
          entries: [],
        });
      }

      // Normalize rows using the factory parser
      const entries = parser.normalize(highlightedRows, {
        reportId: report.id,
        factoryId: factory.id,
        stickyNotes,
      });

      // Insert entries into Supabase
      const { error: insertError } = await supabase
        .from('commission_entries')
        .insert(entries);

      if (insertError) {
        throw new Error(`Failed to insert entries: ${insertError.message}`);
      }

      // Update report status
      await supabase
        .from('reports')
        .update({
          status: 'completed',
          extracted_row_count: entries.length,
          processed_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      return NextResponse.json({
        report_id: report.id,
        factory: parser.name,
        extracted_count: entries.length,
        message: `Successfully extracted ${entries.length} highlighted entries.`,
        entries: entries.map((e) => ({
          customer_name: e.customer_name,
          sales_amount: e.sales_amount,
          commission_amount: e.commission_amount,
          invoice_number: e.invoice_number,
          invoice_date: e.invoice_date,
        })),
      });
    } catch (processingError) {
      // Mark report as failed
      await supabase
        .from('reports')
        .update({
          status: 'failed',
          error_message: processingError instanceof Error ? processingError.message : 'Unknown error',
        })
        .eq('id', report.id);

      throw processingError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extractPeriodFromFilename(filename: string): string | null {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const upper = filename.toUpperCase();
  for (const month of months) {
    if (upper.includes(month)) {
      const yearMatch = filename.match(/20\d{2}/);
      const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
      return `${month} ${year}`;
    }
  }
  return null;
}