import { useEffect, useRef } from 'react';

/** Subscribes to document dismissal events for a mounted interactive layer. */
export const useDismissibleLayer = <T extends HTMLElement>(
  open: boolean,
  setOpen: (open: boolean) => void,
) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return undefined;
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnPointerDown);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnPointerDown);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open, setOpen]);

  return ref;
};
