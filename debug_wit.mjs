// Run with: node debug_wit.mjs /path/to/november-wit.pdf
// Outputs all extracted WIT entries so you can spot the 2 extra rows

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node debug_wit.mjs /path/to/november-wit.pdf');
  process.exit(1);
}

const buffer = readFileSync(pdfPath);

// ---- paste of extractPDFLines + extractWITSections logic ----

async function extractPDFLines(buffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;

  const allLines = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(item => item.str && item.str.trim() !== '');

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
      if (lineText.trim()) allLines.push(lineText);
    }
  }
  return allLines;
}

function parseEuropeanNumber(numStr) {
  if (!numStr || numStr.trim() === '') return 0;
  const cleaned = numStr.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

const lines = await extractPDFLines(buffer);

const sectionCodes = ['5651', '5652'];
let currentSection = null;
let currentCustomerName = null;
let lastFullRowData = null;
const results = [];
let rowNum = 0;

for (const rawLine of lines) {
  const line = rawLine.trimEnd();
  if (!line.trim()) continue;
  if (line.includes('US REPS COMMISSIONS PERIOD') || line.includes('Project Customer P.O.')) continue;

  const sectionMatch = line.match(/^(\d{4})\s+BETSY\s*&\s*MELESSA\s*\(([A-Z]{2})\)/);
  if (sectionMatch) {
    currentSection = sectionCodes.includes(sectionMatch[1]) ? sectionMatch[2] : null;
    lastFullRowData = null;
    continue;
  }

  const otherSection = line.match(/^(\d{4})\s+[A-Z].*\([A-Z]{2}\)/);
  if (otherSection && currentSection !== null) {
    currentSection = null;
    currentCustomerName = null;
    lastFullRowData = null;
    continue;
  }

  if (currentSection === null) continue;
  if (line.trim() === 'Sales rep' || line.trim() === 'Client') continue;

  const customerMatch = line.match(/^(\d{6}(?:-[A-Z]+)?)\s+([A-Z].*)/);
  if (customerMatch && !/^\d{4}-\d{2}-\d{2}/.test(customerMatch[2])) {
    currentCustomerName = customerMatch[2];
    lastFullRowData = null;
    continue;
  }

  if (['Invoice total', 'Customer total', 'Group total', '5649 WIT', '5652 WIT'].some(x => line.includes(x))) continue;
  if (/\d+:\d+:\d+\s+\d+ of \d+/.test(line)) continue;

  const trailingPattern = /(\d+(?:\s\d{3})?,\d+)\s+(\d+(?:\s\d{3})?,\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s*$/;
  const trailingMatch = line.match(trailingPattern);
  if (!trailingMatch) continue;

  const commAmount = parseEuropeanNumber(trailingMatch[5]);
  const netAmount = parseEuropeanNumber(trailingMatch[2]);
  const commRate = parseEuropeanNumber(trailingMatch[4]);

  if (commAmount === 0) continue;

  const prefix = line.slice(0, trailingMatch.index).trimEnd();
  const dateMatches = Array.from(prefix.matchAll(/\d{4}-\d{2}-\d{2}/g)).map(m => ({ date: m[0], index: m.index }));

  if (dateMatches.length >= 2) {
    const tokens = prefix.split(/\s+/);
    const poNumber = tokens[0] ?? '';
    const invoiceDate = dateMatches[0].date;
    const orderEntryDate = dateMatches[1].date;
    const date1End = dateMatches[0].index + invoiceDate.length;
    const date2Start = dateMatches[1].index;
    const date2End = date2Start + orderEntryDate.length;
    const between = prefix.slice(date1End, date2Start).trim().split(/\s+/).filter(Boolean);
    const invoiceNumber = between[0] ?? '';
    const orderNumber = between[1] ?? '';
    const afterDate2 = prefix.slice(date2End).trim();
    const afterTokens = afterDate2.split(/\s+/).filter(Boolean);
    lastFullRowData = {
      customer_name: currentCustomerName ?? '',
      po_number: poNumber,
      invoice_number: invoiceNumber,
      order_number: orderNumber,
      invoice_date: invoiceDate,
      item_code: afterTokens[0] ?? '',
      description: afterTokens.slice(1).join(' '),
    };
  } else {
    if (!lastFullRowData) continue;
    const tokens = prefix.split(/\s+/).filter(Boolean);
    lastFullRowData.item_code = tokens[0] ?? '';
    lastFullRowData.description = tokens.slice(1).join(' ');
  }

  if (lastFullRowData) {
    rowNum++;
    results.push({ rowNum, ...lastFullRowData, netAmount, commRate, commAmount, state: currentSection });
  }
}

// Print all results in a table
console.log(`\nTotal extracted: ${results.length}\n`);
console.log('Row | Customer                          | Invoice     | Date       | CommAmt   | State');
console.log('----+-----------------------------------+-------------+------------+-----------+------');
for (const r of results) {
  const cust = (r.customer_name ?? '').slice(0, 33).padEnd(33);
  const inv = (r.invoice_number ?? '').padEnd(11);
  const date = (r.invoice_date ?? '').padEnd(10);
  const comm = r.commAmount.toFixed(2).padStart(9);
  console.log(`${String(r.rowNum).padStart(3)} | ${cust} | ${inv} | ${date} | ${comm} | ${r.state}`);
}
