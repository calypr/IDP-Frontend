import { useState, useEffect } from 'react';

/**
 * Hook to detect if the page is currently rendered inside an iframe.
 * Safe for Server-Side Rendering (SSR) to prevent hydration mismatches.
 */
export const useIsEmbedded = (): boolean => {
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsEmbedded(window.self !== window.top);
    }
  }, []);

  return isEmbedded;
};
