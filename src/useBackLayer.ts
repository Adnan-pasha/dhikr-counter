import React from 'react';
import { getBackStack } from './backStack';

/** While `active` is true, the phone's back button runs `onBack` (which should close whatever is showing). */
export const useBackLayer = (active: boolean, onBack: () => void): void => {
  const latest = React.useRef(onBack);
  latest.current = onBack;
  React.useEffect(() => {
    if (!active) return;
    const stack = getBackStack();
    const id = stack.push(() => latest.current());
    return () => stack.remove(id);
  }, [active]);
};
