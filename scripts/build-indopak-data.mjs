// Turns the QUL "Digital Khatt Indopak Script - Ayah by Ayah" JSON export into the compact file the reader loads.
// Usage: node scripts/build-indopak-data.mjs <path to digital-khatt-indopak-ayah-by-ayah-script.json>
// Each ayah's text is copied exactly as exported; nothing is edited.
import fs from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Pass the path of the exported JSON file.');
const source = JSON.parse(fs.readFileSync(input, 'utf8'));

const surahs = [];
for (let surah = 1; surah <= 114; surah += 1) {
  const ayahs = [];
  for (let ayah = 1; source[`${surah}:${ayah}`]; ayah += 1) ayahs.push(source[`${surah}:${ayah}`].text);
  if (ayahs.length === 0) throw new Error(`No ayahs found for surah ${surah}.`);
  surahs.push(ayahs);
}
const total = surahs.reduce((sum, a) => sum + a.length, 0);
if (total !== 6236) throw new Error(`Expected 6236 ayahs, found ${total}.`);

fs.writeFileSync(new URL('../src/quran/data/indopak-digitalkhatt.json', import.meta.url), JSON.stringify({ surahs }));
console.log(`Wrote ${total} ayahs in ${surahs.length} surahs.`);
