/**
 * Tajweed colouring. The text service marks each rule in the Arabic as [code:id[letters] (the id is
 * optional, and markers can nest). The tajweed edition spells some letters differently from the Uthmani
 * text, so it is never shown itself: its markers only say which letters of the Uthmani text to colour,
 * and the Uthmani text is displayed exactly as received.
 */

export interface TajweedSegment {
  text: string;
  /** The rule's one-letter code, or null for text that carries no rule. */
  rule: string | null;
}

export interface TajweedRule {
  code: string;
  name: string;
  arabic: string;
  summary: string;
}

/** The rules the text service marks, as described in its tajweed guide. */
export const TAJWEED_RULES: readonly TajweedRule[] = [
  { code: 'h', name: 'Hamzat ul Wasl', arabic: 'همزة الوصل', summary: 'Silent hamza at the start of a word.' },
  { code: 's', name: 'Silent letter', arabic: 'حرف ساكن', summary: 'A letter or vowel that is not pronounced.' },
  { code: 'l', name: 'Laam Shamsiyyah', arabic: 'لام شمسية', summary: 'Solar lam, assimilated into the next letter.' },
  { code: 'n', name: 'Madd Normal', arabic: 'مد عادي', summary: 'Standard prolongation of two counts.' },
  { code: 'p', name: 'Madd Permissible', arabic: 'مد جائز', summary: 'Prolongation of two, four or six counts.' },
  { code: 'm', name: 'Madd Necessary', arabic: 'مد واجب', summary: 'Required prolongation of six counts.' },
  { code: 'o', name: 'Madd Obligatory', arabic: 'مد لازم', summary: 'Required prolongation of four to five counts.' },
  { code: 'q', name: 'Qalqalah', arabic: 'قلقلة', summary: 'An echo on the letters ق ط ب ج د when they carry sukoon.' },
  { code: 'c', name: 'Ikhfa Shafawi', arabic: 'إخفاء شفوي', summary: 'Hidden meem sound before ب.' },
  { code: 'f', name: 'Ikhfa', arabic: 'إخفاء', summary: 'Hidden noon sound (noon sakinah or tanween before certain letters).' },
  { code: 'w', name: 'Idgham Shafawi', arabic: 'إدغام شفوي', summary: 'Meem sakinah merged into a following meem.' },
  { code: 'i', name: 'Iqlab', arabic: 'إقلاب', summary: 'Noon sakinah or tanween turned into meem before ب.' },
  { code: 'a', name: 'Idgham with Ghunnah', arabic: 'إدغام بغنة', summary: 'Merging with a nasal sound.' },
  { code: 'u', name: 'Idgham without Ghunnah', arabic: 'إدغام بلا غنة', summary: 'Merging with no nasal sound.' },
  { code: 'd', name: 'Idgham Mutajanisayn', arabic: 'إدغام متجانسين', summary: 'Merging of letters from the same point of articulation.' },
  { code: 'b', name: 'Idgham Mutaqaribayn', arabic: 'إدغام متقاربين', summary: 'Merging of letters from nearby points of articulation.' },
  { code: 'g', name: 'Ghunnah', arabic: 'غنة', summary: 'Nasal sound held for two counts.' },
];

const RULES_BY_CODE = new Map(TAJWEED_RULES.map((r) => [r.code, r]));

export const ruleFor = (code: string): TajweedRule | null => RULES_BY_CODE.get(code) ?? null;

/** The colour of a rule, defined per reading theme in index.css. */
export const tajweedColorVar = (code: string): string => `var(--tj-${code})`;

const OPEN = /^\[([a-z])(?::\d+)?\[/;

interface RuledChars {
  chars: string[];
  rules: (string | null)[];
}

/** Reads the markers into one rule per character. Returns null when a marker is never closed. */
const readRules = (marked: string): RuledChars | null => {
  const chars: string[] = [];
  const rules: (string | null)[] = [];
  const stack: (string | null)[] = [];
  let i = 0;
  while (i < marked.length) {
    const open = marked[i] === '[' ? OPEN.exec(marked.slice(i, i + 12)) : null;
    if (open) {
      stack.push(ruleFor(open[1]) ? open[1] : (stack[stack.length - 1] ?? null));
      i += open[0].length;
    } else if (marked[i] === ']' && stack.length > 0) {
      stack.pop();
      i += 1;
    } else {
      const ch = String.fromCodePoint(marked.codePointAt(i) as number);
      chars.push(ch);
      rules.push(stack[stack.length - 1] ?? null);
      i += ch.length;
    }
  }
  return stack.length === 0 ? { chars, rules } : null;
};

const group = (chars: readonly string[], rules: readonly (string | null)[]): TajweedSegment[] => {
  const segments: TajweedSegment[] = [];
  chars.forEach((ch, i) => {
    const last = segments[segments.length - 1];
    if (last && last.rule === rules[i]) last.text += ch;
    else segments.push({ text: ch, rule: rules[i] });
  });
  return segments;
};

/** Splits marked text into pieces. A code with no known rule keeps its letters and gets no colour. */
export const parseTajweed = (marked: string): TajweedSegment[] => {
  const read = readRules(marked);
  return read ? group(read.chars, read.rules) : marked ? [{ text: marked, rule: null }] : [];
};

/** The text with every marker removed: what copy, search and screen readers should see. */
export const plainText = (marked: string): string => parseTajweed(marked).map((s) => s.text).join('');

// ── colouring the Uthmani text ───────────────────────────────────────────────

interface Unit {
  /** The base letter. */
  letter: string;
  start: number;
  end: number;
}

const LETTER = /[ء-ؿف-يٮٯٱ-ۓ]/;
const DAGGER_ALEF = 'ٰ';
const TATWEEL = 'ـ';
/** Letters one edition may write as a mark on the previous letter (long vowels and hamza). */
const FLEXIBLE = new Set(['ٲ', 'ء', 'ى', 'ٮ']);
const SAME_FAMILY: readonly string[] = ['اأإآٱٲ', 'ىيٮئ', 'وؤ'];
const HARD_MISMATCH = 9;

const familyOf = (letter: string): string => SAME_FAMILY.find((f) => f.includes(letter)) ?? letter;

/** A unit is a letter with the marks that follow it. Spaces are skipped so words can be spelled with different joins. */
const unitsOf = (chars: readonly string[]): Unit[] => {
  const units: Unit[] = [];
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) return;
    if (LETTER.test(ch) || units.length === 0) units.push({ letter: ch, start: i, end: i + 1 });
    else units[units.length - 1].end = i + 1;
  });
  return units;
};

const substitutionCost = (a: string, b: string): number => (a === b ? 0 : familyOf(a) === familyOf(b) ? 0.1 : HARD_MISMATCH);
const skipCost = (u: Unit): number => (FLEXIBLE.has(u.letter) ? 1 : HARD_MISMATCH);

type Step = { kind: 'match'; t: number; u: number } | { kind: 'skip-tajweed'; t: number } | { kind: 'skip-base'; u: number };

/**
 * Lines the two letter sequences up. Letters that agree at the start and the end are matched directly, so the
 * costly search only runs over the stretch where the editions differ (usually a few letters).
 */
const alignUnits = (t: readonly Unit[], u: readonly Unit[]): Step[] | null => {
  let head = 0;
  while (head < t.length && head < u.length && t[head].letter === u[head].letter) head += 1;
  let tail = 0;
  while (tail < t.length - head && tail < u.length - head && t[t.length - 1 - tail].letter === u[u.length - 1 - tail].letter) tail += 1;

  const middle = alignRange(t.slice(head, t.length - tail), u.slice(head, u.length - tail));
  if (!middle) return null;
  const steps: Step[] = [];
  for (let i = 0; i < head; i += 1) steps.push({ kind: 'match', t: i, u: i });
  for (const step of middle) {
    if (step.kind === 'match') steps.push({ kind: 'match', t: step.t + head, u: step.u + head });
    else if (step.kind === 'skip-tajweed') steps.push({ kind: 'skip-tajweed', t: step.t + head });
    else steps.push({ kind: 'skip-base', u: step.u + head });
  }
  for (let i = tail; i > 0; i -= 1) steps.push({ kind: 'match', t: t.length - i, u: u.length - i });
  return steps;
};

/** The search itself. Returns null unless every difference is a letter that may be written as a mark. */
const alignRange = (t: readonly Unit[], u: readonly Unit[]): Step[] | null => {
  const n = t.length;
  const m = u.length;
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let x = 1; x <= n; x += 1) cost[x][0] = cost[x - 1][0] + skipCost(t[x - 1]);
  for (let y = 1; y <= m; y += 1) cost[0][y] = cost[0][y - 1] + skipCost(u[y - 1]);
  for (let x = 1; x <= n; x += 1) {
    for (let y = 1; y <= m; y += 1) {
      cost[x][y] = Math.min(
        cost[x - 1][y - 1] + substitutionCost(t[x - 1].letter, u[y - 1].letter),
        cost[x - 1][y] + skipCost(t[x - 1]),
        cost[x][y - 1] + skipCost(u[y - 1]),
      );
    }
  }
  if (cost[n][m] >= HARD_MISMATCH) return null;

  const steps: Step[] = [];
  let x = n;
  let y = m;
  while (x > 0 || y > 0) {
    const here = cost[x][y];
    if (x > 0 && y > 0 && here === cost[x - 1][y - 1] + substitutionCost(t[x - 1].letter, u[y - 1].letter)) {
      steps.push({ kind: 'match', t: x - 1, u: y - 1 });
      x -= 1;
      y -= 1;
    } else if (x > 0 && here === cost[x - 1][y] + skipCost(t[x - 1])) {
      steps.push({ kind: 'skip-tajweed', t: x - 1 });
      x -= 1;
    } else {
      steps.push({ kind: 'skip-base', u: y - 1 });
      y -= 1;
    }
  }
  return steps.reverse();
};

const firstRule = (rules: readonly (string | null)[]): string | null => rules.find((r) => r !== null) ?? null;

/**
 * Colours the Uthmani text with the rules marked in the tajweed edition. The Uthmani characters are never
 * changed, added or removed. Returns null when the two texts do not line up letter for letter (apart from
 * letters one edition writes as a mark), so the reader shows plain text rather than a wrong colour.
 */
export const colourText = (tajweedMarked: string, uthmani: string): TajweedSegment[] | null => {
  const read = readRules(tajweedMarked);
  if (!read || read.chars.length === 0 || uthmani.length === 0) return null;
  const baseChars = Array.from(uthmani);
  const tUnits = unitsOf(read.chars);
  const uUnits = unitsOf(baseChars);
  const steps = alignUnits(tUnits, uUnits);
  if (!steps) return null;

  const rules: (string | null)[] = baseChars.map(() => null);
  const matched: { t: Unit; u: Unit; extra: (string | null)[] }[] = [];
  const skippedBase: number[] = [];

  for (const step of steps) {
    if (step.kind === 'match') {
      matched.push({ t: tUnits[step.t], u: uUnits[step.u], extra: [] });
    } else if (step.kind === 'skip-tajweed') {
      // A letter only the tajweed edition spells out: its colour belongs to the letter before it.
      const unit = tUnits[step.t];
      const found = firstRule(read.rules.slice(unit.start, unit.end));
      if (matched.length > 0) matched[matched.length - 1].extra.push(found);
    } else {
      skippedBase.push(step.u);
    }
  }

  for (const { t, u, extra } of matched) {
    const marks = new Map<string, string | null>();
    for (let k = t.start + 1; k < t.end; k += 1) if (!marks.has(read.chars[k])) marks.set(read.chars[k], read.rules[k]);
    const baseRule = read.rules[t.start];
    const maddRule = firstRule([...extra, marks.get(TATWEEL) ?? null, marks.get(DAGGER_ALEF) ?? null]);
    rules[u.start] = baseRule;
    for (let k = u.start + 1; k < u.end; k += 1) {
      const ch = baseChars[k];
      if (marks.has(ch)) rules[k] = marks.get(ch) ?? null;
      else rules[k] = ch === DAGGER_ALEF ? (maddRule ?? baseRule) : baseRule;
    }
  }

  // A letter only the Uthmani text has takes a colour only when the letters on both sides agree on it.
  for (const index of skippedBase) {
    const unit = uUnits[index];
    const before = unit.start > 0 ? rules[unit.start - 1] : null;
    const after = unit.end < rules.length ? rules[unit.end] : null;
    const shared = before !== null && before === after ? before : null;
    for (let k = unit.start; k < unit.end; k += 1) rules[k] = shared;
  }

  return group(baseChars, rules);
};
