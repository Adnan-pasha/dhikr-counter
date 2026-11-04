// Turns the QUL "Indopak 15 lines (Qudratullah)" layout export into the compact file the Pages view loads.
// Usage: node scripts/build-indopak-layout.mjs <folder holding the unzipped 1.json ... 610.json and info.json>
// Only the arrangement is kept: which words (by id) sit on which line of which page. The words themselves
// are not copied; the app draws them from the Digital Khatt IndoPak text, so the layout's own font is not needed.
import fs from 'node:fs';
import path from 'node:path';

const folder = process.argv[2];
if (!folder) throw new Error('Pass the folder of the unzipped layout export.');

const info = JSON.parse(fs.readFileSync(path.join(folder, 'info.json'), 'utf8'));
if (info.number_of_pages !== 610 || info.lines_per_page !== 15) throw new Error('This is not the 610-page, 15-line layout.');

const KIND = { surah_name: 0, basmallah: 1, ayah: 2 };
const ALIGN = { centered: 0, justified: 1 };
const WORDS = 83668;

const pages = [];
let nextWord = 1;
for (let page = 1; page <= info.number_of_pages; page += 1) {
  const source = JSON.parse(fs.readFileSync(path.join(folder, `${page}.json`), 'utf8'));
  const lines = [];
  for (const key of Object.keys(source.lines).sort((a, b) => Number(a) - Number(b))) {
    const line = source.lines[key];
    const kind = KIND[line.type];
    const align = ALIGN[line.alignment];
    if (kind === undefined || align === undefined) throw new Error(`Page ${page} line ${key}: unknown line ${line.type}/${line.alignment}.`);
    if (kind === 0) lines.push([0, align, line.surah_number]);
    else if (kind === 1) lines.push([1, align]);
    else {
      if (line.first_word_id !== nextWord) throw new Error(`Page ${page} line ${key}: expected word ${nextWord}, got ${line.first_word_id}.`);
      lines.push([2, align, line.first_word_id, line.last_word_id]);
      nextWord = line.last_word_id + 1;
    }
  }
  pages.push(lines);
}
if (nextWord - 1 !== WORDS) throw new Error(`Expected ${WORDS} words, the layout covers ${nextWord - 1}.`);

fs.writeFileSync(new URL('../src/quran/data/indopak-15-lines.json', import.meta.url), JSON.stringify({ pages }));
console.log(`Wrote ${pages.length} pages covering ${nextWord - 1} words.`);
