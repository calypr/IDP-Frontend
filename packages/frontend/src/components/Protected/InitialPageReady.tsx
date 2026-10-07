import { createContext, useContext, useEffect } from 'react';

export const InitialPageReadyContext = createContext<(() => void) | undefined>(
  undefined,
);

/** Signal that a page's initial data or client bundle is ready to display. */
export const useInitialPageReady = (ready: boolean) => {
  const reportReady = useContext(InitialPageReadyContext);
  useEffect(() => {
    if (ready) reportReady?.();
  }, [ready, reportReady]);
};
