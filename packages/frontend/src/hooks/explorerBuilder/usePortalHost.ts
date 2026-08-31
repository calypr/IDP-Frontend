import { useEffect, useState } from 'react';

/** Resolves a host owned by the surrounding page and tracks its DOM lifetime. */
export const usePortalHost = (id: string): HTMLElement | null => {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const findHost = () => {
      const next = document.getElementById(id);
      setHost((current) => (current === next ? current : next));
    };
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);

  return host;
};
