import React from 'react';
import {
  BedDouble, Bell, BellOff, BookMarked, BookOpen, CircleDot, CloudSun, Compass, Gem, Hand, HandHeart, Heart,
  Landmark, Leaf, ListChecks, Lock, Moon, MoonStar, PartyPopper, Pencil, Plus, Shield, Sparkles, Star, Sun,
  SunDim, Sunrise, Sunset, Trophy, Volume2, Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Every icon the UI shows, by meaning. Components ask for a key, never an emoji, so icons
 * follow the theme colour, scale with text and render identically on every platform.
 */
export const ICONS = {
  // prayers
  fajr: Sunrise,
  sunrise: SunDim,
  dhuhr: Sun,
  asr: CloudSun,
  maghrib: Sunset,
  isha: MoonStar,
  // adhkaar categories
  morning: Sunrise,
  evening: Sunset,
  beads: CircleDot,
  dua: HandHeart,
  salawat: Heart,
  protection: Shield,
  sleep: BedDouble,
  quran: BookOpen,
  sparkles: Sparkles,
  // navigation and features
  routines: ListChecks,
  mosque: Landmark,
  qibla: Compass,
  book: BookMarked,
  // general
  moon: Moon,
  sun: Sun,
  heart: Heart,
  bell: Bell,
  bellOff: BellOff,
  volume: Volume2,
  plus: Plus,
  edit: Pencil,
  lock: Lock,
  trophy: Trophy,
  celebrate: PartyPopper,
  leaf: Leaf,
  gem: Gem,
  star: Star,
  check: Check,
  hands: Hand,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export const ICON_KEYS = Object.keys(ICONS) as IconKey[];

export const isIconKey = (value: unknown): value is IconKey =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ICONS, value);

/** Icons a user can pick for a routine. */
export const ROUTINE_ICON_KEYS: IconKey[] = [
  'sunrise', 'moon', 'dua', 'beads', 'sparkles', 'mosque', 'heart', 'star', 'sun', 'leaf', 'gem', 'book',
];

const LEGACY_EMOJI: Record<string, IconKey> = {
  '🌅': 'sunrise', '🌄': 'sunrise', '🌙': 'moon', '🤲': 'dua', '📿': 'beads', '✨': 'sparkles',
  '🕌': 'mosque', '💚': 'heart', '🌟': 'star', '☀': 'sun', '🌿': 'leaf', '💎': 'gem', '📖': 'book',
  '😴': 'sleep', '🛡': 'protection', '🌇': 'evening', '🌤': 'asr',
};

/** Map an emoji saved by an older version (routines were stored with an emoji) to an icon key. */
export const iconKeyForEmoji = (emoji: unknown): IconKey => {
  if (typeof emoji !== 'string') return 'sparkles';
  const bare = emoji.replace(/️/g, '');
  return LEGACY_EMOJI[bare] ?? 'sparkles';
};

/** Upgrade a stored routine: keep `icon` if valid, otherwise derive it from the legacy `emoji`. */
export const normalizeRoutine = <T extends { emoji?: unknown; icon?: unknown }>(
  routine: T,
): Omit<T, 'emoji' | 'icon'> & { icon: IconKey } => {
  const { emoji, icon, ...rest } = routine;
  const resolved: IconKey = isIconKey(icon) ? icon : iconKeyForEmoji(emoji);
  return { ...rest, icon: resolved };
};

interface AppIconProps {
  name: IconKey;
  className?: string;
  strokeWidth?: number;
}

/** Decorative icon (hidden from assistive tech); pair with a visible text label. */
export function AppIcon({ name, className = 'w-4 h-4', strokeWidth }: AppIconProps) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
