// Run with: node debug_carnegie2.mjs "/Users/joshschmitt/Desktop/11 Carnegie Oct.pdf"
// Shows RAW pdfjs items (no grouping) with x,y positions - first 40 items on page 1
// This tells us whether cells are separate items or concatenated

import { readFileSync } from 'fs';
import { join } from 'path';

const pdfPath = process.argv[2] || '/Users/joshschmitt/Desktop/11 Carnegie Oct.pdf';
const buffer = readFileSync(pdfPath);

const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`;

const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;

const page = await doc.getPage(1);
const textContent = await page.getTextContent();
const items = textContent.items.filter(i => i.str && i.str.trim());

console.log(`Page 1 has ${items.length} total text items\n`);
console.log('All items sorted by Y (top to bottom), showing x, y, width and text:');
console.log('─'.repeat(90));

// Sort by y descending (top of page first), then x ascending
const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);

for (const item of sorted) {
  const x = item.transform[4].toFixed(1).padStart(7);
  const y = item.transform[5].toFixed(1).padStart(7);
  const w = item.width.toFixed(1).padStart(7);
  // Truncate long strings
  const text = item.str.length > 60 ? item.str.slice(0, 57) + '...' : item.str;
  console.log(`x=${x}  y=${y}  w=${w}  "${text}"`);
}
