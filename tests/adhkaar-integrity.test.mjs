import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADHKAAR_LIBRARY, DEFAULT_ROUTINES } from '../src/adhkaar-data.ts';
import { refreshCorrectedBuiltIns, migrateAndHydrateStorage } from '../src/domain.ts';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/quran-verses.json', import.meta.url), 'utf8'));
const verse = (ref) => fixture.verses[ref];
const byId = (id) => ADHKAAR_LIBRARY.find((d) => d.id === id);

// ── nothing is cut off ────────────────────────────────────────────────────────

test('no dhikr text is cut off with an ellipsis', () => {
  for (const d of ADHKAAR_LIBRARY) {
    for (const [field, text] of [['nameAr', d.nameAr], ['transliteration', d.transliteration], ['meaning', d.meaning]]) {
      assert.doesNotMatch(text ?? '', /(\.\.\.|…)\s*$/, `${d.id}.${field} ends with an ellipsis`);
      assert.doesNotMatch(text ?? '', /\.\.\./, `${d.id}.${field} has "..." in it`);
    }
  }
});

test('every dhikr has its Arabic, its English name and a meaning', () => {
  for (const d of ADHKAAR_LIBRARY) {
    assert.ok(d.nameAr.trim().length > 0, `${d.id} Arabic`);
    assert.ok(d.nameEn.trim().length > 0, `${d.id} name`);
    assert.ok(d.meaning.trim().length > 0, `${d.id} meaning`);
    assert.ok(Number.isInteger(d.targetCount) && d.targetCount >= 0, `${d.id} target`);
  }
});

// ── Quran text is exactly the source ─────────────────────────────────────────

test('Ayatul Kursi is all of verse 2:255, letter for letter as the Quran text source has it', () => {
  assert.equal(byId('ayatul-kursi').nameAr, verse('2:255'));
});

test('the last two verses of Al-Baqarah are all of 2:285 and 2:286', () => {
  assert.equal(byId('last-two-baqarah').nameAr, `${verse('2:285')} ${verse('2:286')}`);
});

test('the fixture is the verbatim Tanzil text with its source recorded', () => {
  assert.match(fixture.source, /Tanzil/);
  assert.match(fixture.source, /CC BY 3\.0/);
  assert.equal(Object.keys(fixture.verses).length, 3);
});

test('the transliteration and meaning of both run to the end of the verse', () => {
  const kursi = byId('ayatul-kursi');
  assert.match(kursi.transliteration, /ʿaẓīm\.?$/i, 'ends with al-ʿAliyyu al-ʿAẓīm');
  assert.match(kursi.transliteration, /Allāhu lā ilāha illā huwa/);
  assert.match(kursi.transliteration, /wa lā yaʾūduhū ḥifẓuhumā/i);
  assert.match(kursi.meaning, /the Most High, the Most Great\.?$/);
  assert.match(kursi.meaning, /Who is it that can intercede/);

  const baqarah = byId('last-two-baqarah');
  assert.match(baqarah.transliteration, /kāfirīn\.?$/, 'ends with the disbelieving people');
  assert.match(baqarah.transliteration, /Rabbanā lā tuʾākhidhnā/i);
  assert.match(baqarah.meaning, /the disbelieving people\.?["”]?$/);
  assert.match(baqarah.meaning, /We hear and we obey/);
});

// ── the routines hang together ────────────────────────────────────────────────

test('every routine lists dhikr that exist, none twice, and at least one', () => {
  const ids = new Set(ADHKAAR_LIBRARY.map((d) => d.id));
  for (const r of DEFAULT_ROUTINES) {
    assert.ok(r.dhikrIds.length > 0, `${r.id} is empty`);
    assert.equal(new Set(r.dhikrIds).size, r.dhikrIds.length, `${r.id} repeats a dhikr`);
    for (const id of r.dhikrIds) assert.ok(ids.has(id), `${r.id} lists ${id}, which does not exist`);
  }
});

test('After Salah is the routine the prayers offer: tasbih, tahmid, takbir, Ayatul Kursi, then the dua and darood', () => {
  const after = DEFAULT_ROUTINES.find((r) => r.id === 'routine-after-salah');
  assert.deepEqual(after.dhikrIds, ['subhanallah', 'alhamdulillah', 'allahuakbar', 'ayatul-kursi', 'dua-good-deed', 'darood-ibrahim']);
  assert.deepEqual(['subhanallah', 'alhamdulillah', 'allahuakbar'].map((id) => byId(id).targetCount), [33, 33, 34]);
});

// ── people who already have the app get the corrected text ────────────────────

// The exact cut-off Arabic these entries had before they were corrected.
const OLD_AR = {
  'ayatul-kursi': 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُۥ مَا فِى ٱلسَّمَٰوَٰتِ وَمَا فِى ٱلْأَرْضِ',
  'last-two-baqarah': 'آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ',
};
const stale = (id) => ({ ...byId(id), nameAr: OLD_AR[id], transliteration: 'cut off...', meaning: 'cut off...' });

test('a saved copy of a corrected entry gets the full text, and keeps the target the person set', () => {
  const saved = [{ ...stale('ayatul-kursi'), targetCount: 3 }, byId('subhanallah')];
  const fixed = refreshCorrectedBuiltIns(saved, ADHKAAR_LIBRARY);
  assert.equal(fixed[0].nameAr, byId('ayatul-kursi').nameAr);
  assert.equal(fixed[0].transliteration, byId('ayatul-kursi').transliteration);
  assert.equal(fixed[0].meaning, byId('ayatul-kursi').meaning);
  assert.equal(fixed[0].targetCount, 3, 'their own target stays');
  assert.equal(fixed[1], saved[1], 'other entries are the same object, untouched');
});

test('entries that are already right are returned as they are', () => {
  const saved = [byId('ayatul-kursi'), byId('last-two-baqarah')];
  const fixed = refreshCorrectedBuiltIns(saved, ADHKAAR_LIBRARY);
  assert.equal(fixed[0], saved[0]);
  assert.equal(fixed[1], saved[1]);
});

test('a person\'s own edit of a corrected entry is kept: only the exact old cut-off text is replaced', () => {
  const edited = { ...byId('ayatul-kursi'), transliteration: 'my own transliteration', meaning: 'my own meaning' };
  const fixed = refreshCorrectedBuiltIns([edited], ADHKAAR_LIBRARY);
  assert.equal(fixed[0], edited, 'already the full text, so nothing is replaced and their wording stays');
  const editedOldArabic = { ...stale('ayatul-kursi'), nameAr: OLD_AR['ayatul-kursi'] + ' (my note)' };
  assert.equal(refreshCorrectedBuiltIns([editedOldArabic], ADHKAAR_LIBRARY)[0], editedOldArabic, 'an edited Arabic line is theirs');
});

test('repairing is idempotent: running it again changes nothing', () => {
  const once = refreshCorrectedBuiltIns([stale('ayatul-kursi'), stale('last-two-baqarah')], ADHKAAR_LIBRARY);
  const twice = refreshCorrectedBuiltIns(once, ADHKAAR_LIBRARY);
  assert.deepEqual(twice, once);
  assert.equal(twice[0], once[0]);
});

test('only the corrected entries are touched: edits to other built-ins and a person\'s own dhikr are left alone', () => {
  const edited = { ...byId('surah-ikhlas'), meaning: 'my own wording' };
  const mine = { id: 'ayatul-kursi-mine', nameAr: 'x', nameEn: 'My dhikr', meaning: 'x', targetCount: 5 };
  const notBuiltIn = { ...stale('ayatul-kursi'), isSystem: false };
  const fixed = refreshCorrectedBuiltIns([edited, mine, notBuiltIn], ADHKAAR_LIBRARY);
  assert.equal(fixed[0], edited);
  assert.equal(fixed[1], mine);
  assert.equal(fixed[2], notBuiltIn, 'a copy that is not marked built-in is theirs');
});

test('a corrected entry that was deleted is not brought back', () => {
  assert.deepEqual(refreshCorrectedBuiltIns([byId('subhanallah')], ADHKAAR_LIBRARY).map((d) => d.id), ['subhanallah']);
});

test('opening the app with old saved data repairs it and saves the repair', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
  localStorage.setItem('tasbih_dhikrs', JSON.stringify([stale('ayatul-kursi'), stale('last-two-baqarah'), byId('subhanallah')]));
  const hydrated = migrateAndHydrateStorage({ defaultDhikrs: ADHKAAR_LIBRARY, defaultPreferences: {}, defaultReminders: [] });
  const kursi = hydrated.dhikrs.find((d) => d.id === 'ayatul-kursi');
  assert.equal(kursi.nameAr, verse('2:255'));
  assert.equal(hydrated.dhikrs.find((d) => d.id === 'last-two-baqarah').nameAr, `${verse('2:285')} ${verse('2:286')}`);
  const saved = JSON.parse(localStorage.getItem('tasbih_dhikrs'));
  assert.equal(saved.find((d) => d.id === 'ayatul-kursi').nameAr, verse('2:255'), 'the repair is written back');
});
