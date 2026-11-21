import { useLayoutEffect, useState } from 'react';

/** Measures a DOM element after its rendered content or dimensions change. */
export const useElementScrollHeight = (
  ref: React.RefObject<HTMLElement | null>,
  identity: string,
  minimum: number,
  maximum: number,
): number => {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () =>
      setHeight(
        element.scrollHeight > maximum
          ? maximum
          : element.scrollHeight === 0
            ? minimum
            : element.scrollHeight,
      );
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(element);
    measure();
    return () => observer?.disconnect();
  }, [identity, maximum, minimum, ref]);

  return height;
};
