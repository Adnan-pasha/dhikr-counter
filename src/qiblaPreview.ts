/**
 * The Qibla screen has a hand-turned dial for previewing it on a computer, which has no compass. On a phone that tool
 * would look like a fake compass, so it is only shown where there is no compass reading and no touch screen.
 */
export const showAlignSimulator = ({ liveSensors, coarsePointer }: { liveSensors: boolean; coarsePointer: boolean }): boolean =>
  !liveSensors && !coarsePointer;

/** Whether this device is used by touch (a phone or tablet). False where the browser cannot say. */
export const hasCoarsePointer = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};
