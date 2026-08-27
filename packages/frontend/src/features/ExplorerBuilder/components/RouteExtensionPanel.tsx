import React, { useMemo } from 'react';
import type { ExplorerBuilderCatalog } from '@gen3/core';
import { derivedOccurrences, type DraftTable } from '../authoring/model';
import { legalEdgesToNode } from '../authoring/routeActions';

const titleForNode = (
  catalog: ExplorerBuilderCatalog,
  nodeId: string | undefined,
): string =>
  catalog.nodes.find((node) => node.nodeId === nodeId)?.resourceType ??
  nodeId ??
  'resource';

export const RouteExtensionPanel = ({
  catalog,
  table,
  selectedOccurrenceId,
  inspectedNodeId,
  selectedEdgeId,
  disabled,
  onSelectEdge,
  onUseAsRowStart,
  onChangeRowStart,
  onAddEdge,
}: {
  readonly catalog: ExplorerBuilderCatalog;
  readonly table?: DraftTable;
  readonly selectedOccurrenceId: string;
  readonly inspectedNodeId?: string;
  readonly selectedEdgeId?: string;
  readonly disabled: boolean;
  readonly onSelectEdge: (edgeId: string | undefined) => void;
  readonly onUseAsRowStart: (nodeId: string) => void;
  readonly onChangeRowStart: (nodeId: string) => void;
  readonly onAddEdge: (edgeId: string, nodeId: string) => void;
}) => {
  const inspectedEdges = useMemo(
    () =>
      legalEdgesToNode(catalog, table, selectedOccurrenceId, inspectedNodeId),
    [catalog, inspectedNodeId, selectedOccurrenceId, table],
  );
  const selectedEdge = inspectedEdges.find(
    (edge) => edge.edgeId === selectedEdgeId,
  );
  const inspectedResource = titleForNode(catalog, inspectedNodeId);
  const occurrences = derivedOccurrences(table, catalog);
  const parent = occurrences.find((item) => item.id === selectedOccurrenceId);
  const parentResource = titleForNode(catalog, parent?.nodeId);
  const inspectedNode = catalog.nodes.find(
    (node) => node.nodeId === inspectedNodeId,
  );
  const alreadyInQuery = occurrences.some(
    (occurrence) => occurrence.nodeId === inspectedNodeId,
  );
  const hasRoot = occurrences.some((occurrence) => occurrence.id === 'base');

  if (!table || !inspectedNodeId || alreadyInQuery) return null;

  if (!hasRoot) {
    return (
      <div className="absolute left-3 top-3 z-20 flex max-w-md items-center gap-3 rounded-xl border border-violet-300 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{inspectedResource}</p>
          <p className="mt-0.5 text-slate-600">
            Start the query with this resource.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          disabled={disabled || !inspectedNode?.rowRootEligible}
          onClick={() => onUseAsRowStart(inspectedNodeId)}
        >
          Start query here
        </button>
      </div>
    );
  }

  // The graph click applies a single unambiguous relationship directly.
  // Controls are only necessary when Loom reports multiple valid edges.
  if (inspectedEdges.length === 1) return null;

  if (inspectedEdges.length === 0) {
    if (!inspectedNode?.rowRootEligible) return null;
    return (
      <div className="absolute left-3 top-3 z-20 flex max-w-lg items-center gap-3 rounded-xl border border-amber-300 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{inspectedResource}</p>
          <p className="mt-0.5 text-slate-600">
            Use this resource as a different query starting point.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          disabled={disabled}
          onClick={() => onChangeRowStart(inspectedNodeId)}
        >
          Start new query from {inspectedResource}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute left-3 top-3 z-20 max-w-lg rounded-xl border border-blue-300 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
      <p className="font-semibold text-slate-900">
        Add {inspectedResource} under {parentResource}
      </p>
      <p className="mt-0.5 text-slate-600">
        Choose which relationship this branch should follow.
      </p>
      <div className="mt-2 flex gap-2">
        <select
          aria-label="Relationship to add"
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-blue-500"
          value={selectedEdge?.edgeId ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onSelectEdge(event.currentTarget.value || undefined)
          }
        >
          <option value="">Choose relationship</option>
          {inspectedEdges.map((edge) => (
            <option key={edge.edgeId} value={edge.edgeId}>
              {edge.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
          disabled={disabled || !selectedEdge}
          onClick={() =>
            selectedEdge &&
            onAddEdge(selectedEdge.edgeId, selectedEdge.toNodeId)
          }
        >
          Add branch
        </button>
      </div>
    </div>
  );
};
