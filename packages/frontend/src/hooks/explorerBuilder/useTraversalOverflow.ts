import { useEffect, useState } from 'react';

export const useTraversalOverflow = (
  graphHostRef: React.RefObject<HTMLDivElement | null>,
  traversalRef: React.RefObject<HTMLElement | null>,
  identity: string,
): boolean => {
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const graphHost = graphHostRef.current;
    const traversal = traversalRef.current;
    if (!graphHost || !traversal) return undefined;
    const measure = () => {
      const truncatedWidth = Array.from(
        traversal.querySelectorAll<HTMLElement>('[data-traversal-label]'),
      ).reduce(
        (width, label) =>
          width + Math.max(0, label.scrollWidth - label.clientWidth),
        0,
      );
      const naturalWidth = traversal.scrollWidth + truncatedWidth;
      const allottedWidth = Math.max(0, graphHost.clientWidth - 9 * 16);
      setOverflowing(naturalWidth > allottedWidth + 1);
    };
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(graphHost);
    measure();
    return () => observer?.disconnect();
  }, [graphHostRef, identity, traversalRef]);

  return overflowing;
};
