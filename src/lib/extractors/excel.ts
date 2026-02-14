import ExcelJS from 'exceljs';
import type { HighlightedRow } from '@/types/commission';

const YELLOW_ARGB_VALUES = new Set([
  'FFFFFF00', 'FFFF00', 'FFFFF200', 'FFFFD700',
]);

function isYellowFill(fill: ExcelJS.Fill | undefined): boolean {
  if (!fill || fill.type !== 'pattern') return false;
  const patternFill = fill as ExcelJS.FillPattern;
  const fg = patternFill.fgColor;
  if (!fg) return false;
  const argb = (fg.argb || '').toUpperCase();
  return YELLOW_ARGB_VALUES.has(argb);
}

export async function extractHighlightedRowsFromExcel(
  buffer: Buffer,
  sheetNameHint?: string
): Promise<{ headers: string[]; rows: HighlightedRow[]; sheetName: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Find the right sheet: use hint, or pick the largest sheet with data
  let targetSheet: ExcelJS.Worksheet | undefined;

  if (sheetNameHint) {
    targetSheet = workbook.worksheets.find(
      (ws) => ws.name.toLowerCase().includes(sheetNameHint.toLowerCase())
    );
  }

  if (!targetSheet) {
    // Pick the sheet with the most rows
    targetSheet = workbook.worksheets.reduce((best, ws) =>
      ws.rowCount > (best?.rowCount || 0) ? ws : best
    );
  }

  if (!targetSheet) {
    throw new Error('No worksheet found in the Excel file');
  }

  // Find the header row (first row with 3+ non-empty cells)
  let headerRowNum = 1;
  let headers: string[] = [];

  targetSheet.eachRow((row, rowNum) => {
    if (headers.length > 0) return;
    const nonEmpty = row.values
      ? (row.values as (ExcelJS.CellValue)[]).filter((v) => v != null && v !== '')
      : [];
    if (nonEmpty.length >= 3) {
      headerRowNum = rowNum;
      headers = [];
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        headers[colNum - 1] = cell.text?.toString().trim() || `Col${colNum}`;
      });
    }
  });

  // Extract yellow-highlighted rows
  const highlightedRows: HighlightedRow[] = [];

  targetSheet.eachRow((row, rowNum) => {
    if (rowNum <= headerRowNum) return;

    let hasYellow = false;
    row.eachCell((cell) => {
      if (isYellowFill(cell.fill)) {
        hasYellow = true;
      }
    });

    if (!hasYellow) return;

    const cells: Record<string, string | number | null> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const key = headers[colNum - 1] || `Col${colNum}`;
      const val = cell.value;
      if (val === null || val === undefined) {
        cells[key] = null;
      } else if (typeof val === 'object' && 'result' in val) {
        // Formula cell — use the result
        cells[key] = val.result as string | number;
      } else if (val instanceof Date) {
        cells[key] = val.toISOString().split('T')[0];
      } else {
        cells[key] = val as string | number;
      }
    });

    highlightedRows.push({ rowNumber: rowNum, cells });
  });

  return {
    headers: headers.filter(Boolean),
    rows: highlightedRows,
    sheetName: targetSheet.name,
  };
}
