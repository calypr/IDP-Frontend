import { useEffect } from 'react';

/** Owns the browser lifecycle subscription for an unsaved Builder draft. */
export const useDirtyBeforeUnload = (dirty: boolean): void => {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
};
