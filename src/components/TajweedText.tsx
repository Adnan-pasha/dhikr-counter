import React from 'react';
import { tajweedColorVar, type TajweedSegment } from '../quran/tajweed';

/** Arabic text with each tajweed rule drawn in its colour. Only the colour changes: the letters are exactly as received. */
export default function TajweedText({ segments }: { segments: readonly TajweedSegment[] }) {
  return (
    <>
      {segments.map((segment, i) => segment.rule
        ? <span key={i} data-rule={segment.rule} style={{ color: tajweedColorVar(segment.rule) }}>{segment.text}</span>
        : <React.Fragment key={i}>{segment.text}</React.Fragment>)}
    </>
  );
}
