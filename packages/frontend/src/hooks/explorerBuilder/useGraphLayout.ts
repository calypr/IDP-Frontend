import { useEffect, useState } from 'react';
import {
  layoutDatasetGraph,
  type GraphLayoutEdge,
  type GraphLayoutNode,
} from '../../features/ExplorerBuilder/graphLayout';

interface GraphLayoutState {
  readonly identity?: string;
  readonly positions: ReadonlyMap<string, { x: number; y: number }>;
}

/** Runs the asynchronous ELK layout and ignores results for obsolete catalogs. */
export const useGraphLayout = (
  identity: string,
  nodes: ReadonlyArray<GraphLayoutNode>,
  edges: ReadonlyArray<GraphLayoutEdge>,
): GraphLayoutState => {
  const [layout, setLayout] = useState<GraphLayoutState>({
    positions: new Map(),
  });

  useEffect(() => {
    let active = true;
    setLayout({ positions: new Map() });
    void layoutDatasetGraph(nodes, edges)
      .then((value) => {
        if (active) setLayout({ identity, positions: value.positions });
      })
      .catch(() => {
        if (active) setLayout({ identity, positions: new Map() });
      });
    return () => {
      active = false;
    };
  }, [edges, identity, nodes]);

  return layout;
};
