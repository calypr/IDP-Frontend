import React, { useMemo } from 'react';
import type { ExplorerBuilderCatalog } from '@gen3/core';
import { routeTailNodeId, type DraftTable } from '../authoring/model';
import {
  legalEdgesToNode,
  legalOutgoingEdges,
} from '../authoring/routeActions';

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
  readonly inspectedNodeId?: string;
  readonly selectedEdgeId?: string;
  readonly disabled: boolean;
  readonly onSelectEdge: (edgeId: string | undefined) => void;
  readonly onUseAsRowStart: (nodeId: string) => void;
  readonly onChangeRowStart: (nodeId: string) => void;
  readonly onAddEdge: (edgeId: string, nodeId: string) => void;
}) => {
  const outgoingEdges = useMemo(
    () => legalOutgoingEdges(catalog, table),
    [catalog, table],
  );
  const inspectedEdges = useMemo(
    () => legalEdgesToNode(catalog, table, inspectedNodeId),
    [catalog, inspectedNodeId, table],
  );
  const edgeOptions = inspectedNodeId ? inspectedEdges : outgoingEdges;
  const selectedEdge = edgeOptions.find(
    (edge) => edge.edgeId === selectedEdgeId,
  );
  const inspectedResource = titleForNode(catalog, inspectedNodeId);
  const baseResource = titleForNode(catalog, table?.rootNodeId);
  const tailResource = titleForNode(catalog, routeTailNodeId(table, catalog));
  const canChangeRowStart = Boolean(
    inspectedNodeId &&
      inspectedNodeId !== table?.rootNodeId &&
      catalog.nodes.find((node) => node.nodeId === inspectedNodeId)
        ?.rowRootEligible,
  );

  if (!table) return null;

  if (!table.rootNodeId) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs">
        <span className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold uppercase tracking-wide text-slate-600">
          Row start
        </span>
        <span className="mr-auto text-slate-600">
          Inspect a resource, then make it the first step in each row.
        </span>
        <button
          type="button"
          className="rounded-md bg-violet-700 px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            disabled ||
            !inspectedNodeId ||
            !catalog.nodes.find((node) => node.nodeId === inspectedNodeId)
              ?.rowRootEligible
          }
          onClick={() => inspectedNodeId && onUseAsRowStart(inspectedNodeId)}
        >
          Use {inspectedNodeId ? inspectedResource : 'selected resource'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold uppercase tracking-wide text-slate-600">
          Route
        </span>
        <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-900">
          Row start: <strong>{baseResource}</strong>
        </span>
        <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700">
          Current tail: <strong>{tailResource}</strong>
        </span>
        {canChangeRowStart && (
          <button
            type="button"
            className="rounded border border-violet-300 bg-white px-2 py-1 font-semibold text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={() => inspectedNodeId && onChangeRowStart(inspectedNodeId)}
          >
            Change start to {inspectedResource}
          </button>
        )}
        <span className="ml-auto text-slate-500">Next step</span>
        <select
          aria-label="Relationship to add"
          className="min-w-52 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-blue-500"
          value={selectedEdge?.edgeId ?? ''}
          disabled={disabled || edgeOptions.length === 0}
          onChange={(event) =>
            onSelectEdge(event.currentTarget.value || undefined)
          }
        >
          <option value="">
            {inspectedNodeId
              ? `Choose a relationship to ${inspectedResource}`
              : 'Choose a relationship'}
          </option>
          {edgeOptions.map((edge) => (
            <option key={edge.edgeId} value={edge.edgeId}>
              {edge.label} → {titleForNode(catalog, edge.toNodeId)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md bg-blue-700 px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={disabled || !selectedEdge}
          onClick={() =>
            selectedEdge &&
            onAddEdge(selectedEdge.edgeId, selectedEdge.toNodeId)
          }
        >
          Add step
        </button>
      </div>
      {edgeOptions.length === 0 && (
        <p className="mt-2 border-l-2 border-amber-400 pl-2 text-amber-800">
          {inspectedNodeId
            ? `${inspectedResource} is not a valid next step from ${tailResource}. Select a highlighted outgoing relationship.`
            : `There are no available outgoing relationships from ${tailResource}.`}
        </p>
      )}
    </div>
  );
};
