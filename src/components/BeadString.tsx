import React from 'react';
import { motion } from 'motion/react';
import { beadLayout } from '../counter';

interface BeadStringProps {
  total: number;
  filled: number;
  color: string;
  className?: string;
}

const WIDTH = 360;
const HEIGHT = 96;
const SAG = 58;

/**
 * A hanging string of beads that fills as the count rises. Decorative: the count itself is
 * announced through the counter's live region, so the whole graphic is hidden from assistive tech.
 */
export default function BeadString({ total, filled, color, className }: BeadStringProps) {
  const beads = React.useMemo(() => beadLayout(total, WIDTH, SAG), [total]);
  const path = beads.map((b, i) => `${i === 0 ? 'M' : 'L'}${b.x.toFixed(1)} ${b.y.toFixed(1)}`).join(' ');
  const newest = filled - 1;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={path} fill="none" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {beads.map((b, i) => {
        const isFilled = i < filled;
        const isNewest = i === newest;
        return (
          <motion.circle
            key={isNewest ? `newest-${filled}` : `bead-${i}`}
            cx={b.x}
            cy={b.y}
            r={b.r}
            fill={isFilled ? color : 'var(--color-bg-overlay)'}
            stroke={isFilled ? 'none' : 'var(--color-border)'}
            strokeWidth="1"
            initial={isNewest ? { scale: 1.7 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 20 }}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              filter: isNewest ? `drop-shadow(0 0 5px ${color})` : undefined,
            }}
          />
        );
      })}
    </svg>
  );
}
