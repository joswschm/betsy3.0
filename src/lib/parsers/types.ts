import type { CommissionEntry, HighlightedRow } from '@/types/commission';

export interface FactoryParser {
  name: string;
  factoryKey: string; // matches factories.name in DB
  format: 'excel' | 'pdf';

  /** Hints for the Excel extractor (e.g., which sheet to target) */
  sheetNameHint?: string;

  /** Auto-detect if a file belongs to this factory */
  detect(filename: string, headers?: string[]): boolean;

  /** Convert highlighted rows into normalized CommissionEntry objects */
  normalize(
    rows: HighlightedRow[],
    context: {
      reportId: string;
      factoryId: string;
      stickyNotes?: { text: string; rect: number[] }[];
    }
  ): CommissionEntry[];
}
