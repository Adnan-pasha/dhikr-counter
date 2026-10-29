import React from 'react';

/**
 * What every modal sheet needs: focus moves in when it opens, Tab stays inside while it is open, and
 * Escape closes it from anywhere on the page.
 */
export const useModalDialog = (open: boolean, onClose: () => void) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const initialFocusRef = React.useRef<HTMLButtonElement>(null);

  // Focus moves in when the sheet opens and goes back to whatever opened it when it closes.
  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    initialFocusRef.current?.focus();
    return () => { if (opener && typeof opener.focus === 'function') opener.focus(); };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const found = dialogRef.current.querySelectorAll('button, input, a[href]') as NodeListOf<HTMLElement>;
    const items = Array.from(found).filter((el: HTMLElement) => !el.hasAttribute('disabled'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return { dialogRef, initialFocusRef, onKeyDown: trapTab };
};
