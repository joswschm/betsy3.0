import type { HighlightedRow } from '@/types/commission';

// pdfjs-dist types
interface PDFAnnotation {
  subtype: string;
  color: Uint8ClampedArray | number[];
  rect: number[];
  contentsObj?: { str: string };
  contents?: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export async function extractHighlightedRowsFromPDF(
  buffer: Buffer
): Promise<{ rows: HighlightedRow[]; stickyNotes: { text: string; rect: number[] }[] }> {
  // Dynamic import for pdfjs-dist (server-side)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;

  const allHighlightedRows: HighlightedRow[] = [];
  const allStickyNotes: { text: string; rect: number[] }[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const annotations: PDFAnnotation[] = await page.getAnnotations();
    const textContent = await page.getTextContent();
    const textItems = textContent.items as TextItem[];

    // Find highlight annotations (yellow)
    const highlights = annotations.filter((a) => {
      if (a.subtype !== 'Highlight') return false;
      if (!a.color || a.color.length < 3) return false;
      const r = a.color[0];
      const g = a.color[1];
      const b = a.color[2];
      // Yellow: high R, high G, low B (values 0-255 or 0-1 depending on PDF)
      const rNorm = r > 1 ? r / 255 : r;
      const gNorm = g > 1 ? g / 255 : g;
      const bNorm = b > 1 ? b / 255 : b;
      return rNorm > 0.8 && gNorm > 0.8 && bNorm < 0.3;
    });

    // Find sticky note annotations
    const stickyNotes = annotations.filter((a) => a.subtype === 'Text');
    for (const note of stickyNotes) {
      const text = note.contentsObj?.str || note.contents || '';
      if (text) {
        allStickyNotes.push({ text, rect: Array.from(note.rect) });
      }
    }

    // For each highlight, find the text within its bounding rect
    for (const highlight of highlights) {
      const [x1, y1, x2, y2] = highlight.rect;
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      // Expand the rect vertically to capture the full row
      const rowMinY = minY - 5;
      const rowMaxY = maxY + 5;

      // Collect text items that fall within or near the highlight rect
      // Expand horizontally to capture the full row (entire page width)
      const rowTextItems = textItems.filter((item) => {
        const itemY = item.transform[5]; // y position
        return itemY >= rowMinY && itemY <= rowMaxY;
      });

      // Sort by x position to maintain reading order
      rowTextItems.sort((a, b) => a.transform[4] - b.transform[4]);

      // Group text items into columns based on x-position gaps
      const columns = groupIntoColumns(rowTextItems);
      const cells: Record<string, string | number | null> = {};
      columns.forEach((col, idx) => {
        cells[`Col${idx + 1}`] = col;
      });

      allHighlightedRows.push({
        rowNumber: pageNum,
        cells,
      });
    }
  }

  return { rows: allHighlightedRows, stickyNotes: allStickyNotes };
}

function groupIntoColumns(items: TextItem[]): string[] {
  if (items.length === 0) return [];

  const columns: string[] = [];
  let currentCol = items[0].str;
  let lastX = items[0].transform[4] + items[0].width;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const itemX = item.transform[4];
    const gap = itemX - lastX;

    // If there's a significant gap, start a new column
    if (gap > 10) {
      columns.push(currentCol.trim());
      currentCol = item.str;
    } else {
      currentCol += item.str;
    }
    lastX = itemX + item.width;
  }
  columns.push(currentCol.trim());

  return columns.filter((c) => c.length > 0);
}
