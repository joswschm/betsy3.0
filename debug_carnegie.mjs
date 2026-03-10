// Run with: node debug_carnegie.mjs /path/to/carnegie.pdf
// Shows exactly what text pdfjs-dist extracts, so we can see what the parser sees

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node debug_carnegie.mjs /path/to/carnegie.pdf');
  process.exit(1);
}

const buffer = readFileSync(pdfPath);

const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`;

const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
console.log(`PDF has ${doc.numPages} pages\n`);

for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const items = textContent.items.filter(item => item.str && item.str.trim() !== '');

  // Group by y position with 3pt tolerance
  const lineGroups = [];
  for (const item of items) {
    const y = item.transform[5];
    const x = item.transform[4];
    const endX = x + item.width;
    const existing = lineGroups.find(g => Math.abs(g.centerY - y) <= 3);
    if (existing) {
      existing.entries.push({ x, endX, str: item.str });
      existing.centerY = (existing.centerY + y) / 2;
    } else {
      lineGroups.push({ centerY: y, entries: [{ x, endX, str: item.str }] });
    }
  }

  lineGroups.sort((a, b) => b.centerY - a.centerY);

  console.log(`\n===== PAGE ${pageNum} =====`);
  for (const group of lineGroups) {
    group.entries.sort((a, b) => a.x - b.x);
    let lineText = '';
    let lastEndX = -Infinity;
    for (const entry of group.entries) {
      if (lineText === '') {
        lineText = entry.str;
      } else {
        const gap = entry.x - lastEndX;
        lineText += (gap > 3 ? ' ' : '') + entry.str;
      }
      lastEndX = Math.max(lastEndX, entry.endX);
    }
    if (lineText.trim()) console.log(lineText);
  }
}
