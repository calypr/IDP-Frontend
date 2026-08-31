import { useEffect } from 'react';
import { useNodesInitialized, useReactFlow } from '@xyflow/react';

export const useGraphViewportFitter = ({
  expanded,
  graphIdentity,
  hostRef,
  nodeCount,
}: {
  readonly expanded: boolean;
  readonly graphIdentity: string;
  readonly hostRef: React.RefObject<HTMLDivElement | null>;
  readonly nodeCount: number;
}): void => {
  const flow = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const viewportInitialized = flow.viewportInitialized;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !nodesInitialized || !viewportInitialized || nodeCount === 0)
      return undefined;

    let firstFrame = 0;
    let secondFrame = 0;
    const fit = () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          void flow.fitView({
            padding: 0.08,
            minZoom: 0.05,
            maxZoom: 1.8,
            duration: 200,
          });
        });
      });
    };

    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(fit);
    observer?.observe(host);
    fit();
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      observer?.disconnect();
    };
  }, [
    expanded,
    flow,
    graphIdentity,
    hostRef,
    nodeCount,
    nodesInitialized,
    viewportInitialized,
  ]);
};
