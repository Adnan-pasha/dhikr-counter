import React from 'react';
import {
  ayahIndexOfWord, fitFontSize, linesOfPage, wordsOfLine,
  type IndopakWords, type LayoutData, type LayoutLine,
} from '../quran/indopak-layout';
import { BASMALA_INDOPAK } from '../quran/indopak';
import type { Surah } from '../quran/types';

interface LayoutPageViewProps {
  layout: LayoutData;
  words: IndopakWords;
  page: number;
  surahs: readonly Surah[];
  /** The ayah (0 to 6235) being looked at, or null. */
  selected: number | null;
  onSelect: (ayahIndex: number) => void;
}

const BASE_PX = 40;
const LINE_HEIGHT = 1.9;
/** The gap between words as a fraction of the font size: wide enough to read, the justified lines add the rest. */
const WORD_GAP_EM = 0.3;
/** Lines of a full page, so every page is drawn at the same size and short pages keep their position. */
const PAGE_LINES = 15;
const FONT_NAME = '"DigitalKhatt IndoPak"';

const KEY = (line: LayoutLine, i: number) => `${i}-${line.kind}`;

/**
 * One printed page of the 15-line mushaf. Every line is stretched edge to edge like the print, and the type
 * size is the largest at which the widest line still fits and all fifteen lines fit the height, so a page is
 * seen whole with no scrolling. Words are tappable; tapping one chooses its ayah.
 */
export default function LayoutPageView({ layout, words, page, surahs, selected, onSelect }: LayoutPageViewProps) {
  const areaRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = React.useState(24);
  const lines = React.useMemo(() => linesOfPage(layout, page), [layout, page]);

  // While an ayah is open the details bar takes half the screen. The text keeps its size then, and the page
  // scrolls, instead of shrinking to something unreadable.
  const frozen = selected !== null;
  const frozenRef = React.useRef(frozen);
  frozenRef.current = frozen;

  const measure = React.useCallback(() => {
    if (frozenRef.current) return;
    const area = areaRef.current;
    const ruler = measureRef.current;
    if (!area || !ruler) return;
    const widths = Array.from(ruler.querySelectorAll<HTMLElement>('[data-natural]')).map((el) => el.getBoundingClientRect().width);
    const style = window.getComputedStyle(area);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    setFontSize(fitFontSize({
      baseSize: BASE_PX,
      naturalWidths: widths,
      containerWidth: area.clientWidth - padX,
      availableHeight: area.clientHeight - padY,
      lineCount: PAGE_LINES,
      lineHeight: LINE_HEIGHT,
    }));
  }, []);

  // Measure after the page is drawn, again once the font has loaded (its widths differ from the fallback's),
  // and whenever the screen changes size.
  React.useLayoutEffect(() => { measure(); }, [measure, lines, frozen]);

  // The chosen ayah stays in view once the bar has taken its space.
  React.useEffect(() => {
    if (selected === null) return;
    areaRef.current?.querySelector<HTMLElement>(`[data-ayah-index="${selected}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  React.useEffect(() => {
    let alive = true;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.load?.(`${BASE_PX}px ${FONT_NAME}`).then(() => { if (alive) measure(); }, () => {});
    const observer = typeof ResizeObserver !== 'undefined' && areaRef.current ? new ResizeObserver(() => measure()) : null;
    if (observer && areaRef.current) observer.observe(areaRef.current);
    return () => { alive = false; observer?.disconnect(); };
  }, [measure]);

  const surahName = (n: number) => surahs.find((s) => s.number === n)?.name ?? `Surah ${n}`;
  const chosen = selected;

  const wordSpans = (line: Extract<LayoutLine, { kind: 'ayah' }>) =>
    wordsOfLine(words, line).map((text, k) => {
      const id = line.from + k;
      const ayah = ayahIndexOfWord(words, id);
      const on = chosen === ayah;
      return (
        <span
          key={id}
          data-word={id}
          data-ayah-index={ayah}
          onClick={() => onSelect(ayah)}
          className="cursor-pointer rounded-md"
          style={on ? { background: 'color-mix(in srgb, var(--reader-accent) 25%, transparent)' } : undefined}
        >
          {text}
        </span>
      );
    });

  return (
    <div
      ref={areaRef}
      data-layout-page={page}
      className={`relative flex min-h-0 flex-1 flex-col justify-start px-3 py-2 ${frozen ? 'overflow-y-auto' : 'overflow-hidden'}`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Unseen copy of each line at a known size: its widths say how large the page can be drawn. */}
      <div ref={measureRef} aria-hidden="true" className="font-indopak pointer-events-none absolute left-0 top-0 flex h-0 w-max flex-col items-start overflow-hidden opacity-0" style={{ fontSize: BASE_PX, visibility: 'hidden' }}>
        {lines.map((line, i) => line.kind === 'ayah' && (
          <span key={KEY(line, i)} data-natural className="inline-flex whitespace-nowrap" style={{ gap: `${WORD_GAP_EM}em` }}>
            {wordsOfLine(words, line).map((text, k) => <span key={k}>{text}</span>)}
          </span>
        ))}
      </div>

      <div lang="ar" dir="rtl" className="font-indopak flex flex-col" style={{ fontSize, lineHeight: LINE_HEIGHT, color: 'var(--reader-ink)' }}>
        {lines.map((line, i) => {
          if (line.kind === 'surah') {
            return (
              <div key={KEY(line, i)} className="flex items-center justify-center" style={{ height: `${LINE_HEIGHT}em` }}>
                <span
                  className="rounded-lg px-4 font-quran"
                  style={{ fontSize: '0.8em', lineHeight: 1.5, color: 'var(--reader-accent)', border: '1px solid var(--reader-border)', background: 'var(--reader-surface)' }}
                >
                  {surahName(line.surah)}
                </span>
              </div>
            );
          }
          if (line.kind === 'basmala') {
            return (
              <div key={KEY(line, i)} className="text-center" style={{ height: `${LINE_HEIGHT}em`, color: 'var(--reader-accent)' }}>{BASMALA_INDOPAK}</div>
            );
          }
          return (
            <div
              key={KEY(line, i)}
              data-line={i + 1}
              className="flex whitespace-nowrap"
              style={{ height: `${LINE_HEIGHT}em`, gap: `${WORD_GAP_EM}em`, justifyContent: line.align === 'justified' ? 'space-between' : 'center', alignItems: 'center' }}
            >
              {wordSpans(line)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
