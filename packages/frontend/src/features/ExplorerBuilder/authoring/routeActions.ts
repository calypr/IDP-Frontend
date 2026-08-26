import type { ExplorerBuilderCatalog } from '@gen3/core';
import { routeTailNodeId, type DraftTable } from './model';

/**
 * The graph is allowed to inspect the full catalog, but authoring may only
 * use edges that leave the current route tail. Keeping this rule pure makes
 * it reusable by the canvas, the explicit route controls, and tests.
 */
export const legalOutgoingEdges = (
  catalog: ExplorerBuilderCatalog,
  table: DraftTable | undefined,
): ExplorerBuilderCatalog['edges'] => {
  const tailNodeId = routeTailNodeId(table, catalog);
  if (!table?.rootNodeId || !tailNodeId) return [];
  const allowsRepeated =
    catalog.routePolicy.allowRepeatedEdges ??
    catalog.routePolicy.repeatedEdges ??
    false;
  const allowsSelfLoops =
    catalog.routePolicy.allowSelfLoops ?? catalog.routePolicy.selfLoops ?? false;
  const maxSteps = catalog.routePolicy.maxSteps;
  if (maxSteps && table.routeSteps.length >= maxSteps) return [];
  return catalog.edges.filter((edge) => {
    if (edge.fromNodeId !== tailNodeId) return false;
    if (edge.fromNodeId === edge.toNodeId && !allowsSelfLoops) return false;
    return (
      allowsRepeated ||
      !table.routeSteps.some((step) => step.edgeId === edge.edgeId)
    );
  });
};

export const legalEdgesToNode = (
  catalog: ExplorerBuilderCatalog,
  table: DraftTable | undefined,
  nodeId: string | undefined,
): ExplorerBuilderCatalog['edges'] => {
  if (!nodeId) return [];
  return legalOutgoingEdges(catalog, table).filter(
    (edge) => edge.toNodeId === nodeId,
  );
};

export const isLegalRouteExtension = (
  catalog: ExplorerBuilderCatalog,
  table: DraftTable | undefined,
  edgeId: string,
  targetNodeId: string,
): boolean =>
  legalOutgoingEdges(catalog, table).some(
    (edge) => edge.edgeId === edgeId && edge.toNodeId === targetNodeId,
  );
