import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';

export interface GraphLayoutNode {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface GraphLayoutEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface GraphLayoutResult {
  readonly positions: ReadonlyMap<
    string,
    { readonly x: number; readonly y: number }
  >;
  readonly routes: ReadonlyMap<string, string>;
}

const elk = new ELK();

const routePath = (
  section:
    | {
        readonly startPoint: { readonly x: number; readonly y: number };
        readonly bendPoints?: ReadonlyArray<{
          readonly x: number;
          readonly y: number;
        }>;
        readonly endPoint: { readonly x: number; readonly y: number };
      }
    | undefined,
): string | undefined => {
  if (!section) return undefined;
  const points = [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ];
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
};

/** Deterministic layered layout used by the PR #105 graph canvas. */
export const layoutDatasetGraph = async (
  nodes: ReadonlyArray<GraphLayoutNode>,
  edges: ReadonlyArray<GraphLayoutEdge>,
): Promise<GraphLayoutResult> => {
  if (nodes.length === 0) return { positions: new Map(), routes: new Map() };
  const input: ElkNode = {
    id: 'dataset-graph',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.aspectRatio': '2.2',
      'elk.padding': '[top=60,left=60,bottom=60,right=60]',
      'elk.spacing.nodeNode': '72',
      'elk.spacing.componentComponent': '110',
      'elk.layered.spacing.nodeNodeBetweenLayers': '170',
      'elk.layered.spacing.edgeNodeBetweenLayers': '70',
      'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.nodePlacement.favorStraightEdges': 'true',
      'elk.layered.cycleBreaking.strategy': 'GREEDY_MODEL_ORDER',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.separateConnectedComponents': 'true',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };
  const graph = await elk.layout(input);
  const children = graph.children ?? [];
  const missingPosition = nodes.find((node) => {
    const laidOut = children.find((candidate) => candidate.id === node.id);
    return (
      !laidOut || !Number.isFinite(laidOut.x) || !Number.isFinite(laidOut.y)
    );
  });
  if (missingPosition) {
    throw new Error(
      `ELK returned no finite position for graph node ${missingPosition.id}.`,
    );
  }
  return {
    positions: new Map(
      children.map((node) => [
        node.id,
        { x: node.x as number, y: node.y as number },
      ]),
    ),
    routes: new Map(
      (graph.edges ?? []).flatMap((edge) => {
        const path = routePath(edge.sections?.[0]);
        return path ? [[edge.id, path] as const] : [];
      }),
    ),
  };
};
