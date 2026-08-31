import { useEffect } from 'react';

export const useEscapeToClose = (
  open: boolean,
  setOpen: (open: boolean) => void,
): void => {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, setOpen]);
};
