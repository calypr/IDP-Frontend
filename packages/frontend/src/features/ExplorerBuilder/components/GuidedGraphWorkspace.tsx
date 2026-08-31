import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Background, Controls, MarkerType, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { ExplorerBuilderCatalog } from '@gen3/core';
import { derivedOccurrences, type DraftTable } from '../authoring/model';
import { legalOutgoingEdges } from '../authoring/routeActions';
import { RouteExtensionPanel } from './RouteExtensionPanel';
import { useEscapeToClose } from '../../../hooks/explorerBuilder/useEscapeToClose';
import { useGraphLayout } from '../../../hooks/explorerBuilder/useGraphLayout';
import { useGraphViewportFitter } from '../../../hooks/explorerBuilder/useGraphViewportFitter';
import { useTraversalOverflow } from '../../../hooks/explorerBuilder/useTraversalOverflow';

const GraphViewportFitter = ({
  expanded,
  graphIdentity,
  hostRef,
  nodeCount,
}: {
  readonly expanded: boolean;
  readonly graphIdentity: string;
  readonly hostRef: React.RefObject<HTMLDivElement | null>;
  readonly nodeCount: number;
}) => {
  useGraphViewportFitter({ expanded, graphIdentity, hostRef, nodeCount });
  return null;
};

export const GuidedGraphWorkspace = ({
  catalog,
  table,
  selectedOccurrenceId,
  disabled,
  onSelectOccurrence,
  onSetBase,
  onChangeBase,
  onAppendEdge,
  onTruncate,
  onTableToolbarHostChange,
}: {
  readonly catalog: ExplorerBuilderCatalog;
  readonly table?: DraftTable;
  readonly selectedOccurrenceId: string;
  readonly disabled: boolean;
  readonly onSelectOccurrence: (id: string) => void;
  readonly onSetBase: (nodeId: string) => void;
  readonly onChangeBase: (nodeId: string) => void;
  readonly onAppendEdge: (
    parentOccurrenceId: string,
    edgeId: string,
    nodeId: string,
  ) => void;
  readonly onTruncate: (occurrenceId: string) => void;
  readonly onTableToolbarHostChange?: (host: HTMLDivElement | null) => void;
}) => {
  const graphHostRef = React.useRef<HTMLDivElement>(null);
  const traversalRef = React.useRef<HTMLElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOrphans, setShowOrphans] = useState(false);
  const catalogIdentity = useMemo(
    () =>
      JSON.stringify({
        nodes: catalog.nodes.map((node) => node.nodeId),
        edges: catalog.edges.map((edge) => [
          edge.edgeId,
          edge.fromNodeId,
          edge.toNodeId,
        ]),
      }),
    [catalog.edges, catalog.nodes],
  );
  const layoutNodes = useMemo(
    () =>
      catalog.nodes.map((node) => ({
        id: node.nodeId,
        width: 170,
        height: 54,
      })),
    [catalog.nodes],
  );
  const layoutEdges = useMemo(
    () =>
      catalog.edges.map((edge) => ({
        id: edge.edgeId,
        source: edge.fromNodeId,
        target: edge.toNodeId,
      })),
    [catalog.edges],
  );
  const layout = useGraphLayout(catalogIdentity, layoutNodes, layoutEdges);
  useEscapeToClose(isExpanded, setIsExpanded);
  const tableIdentity = `${table?.outputId ?? ''}:${table?.document.rootResourceType ?? ''}`;
  const [inspection, setInspection] = useState<{
    readonly tableIdentity: string;
    readonly occurrenceId: string;
    readonly nodeId?: string;
    readonly edgeId?: string;
  }>({ tableIdentity, occurrenceId: selectedOccurrenceId });
  const activeInspectedNodeId =
    inspection.tableIdentity === tableIdentity ? inspection.nodeId : undefined;
  const activeSelectedEdgeId =
    inspection.tableIdentity === tableIdentity &&
    inspection.occurrenceId === selectedOccurrenceId
      ? inspection.edgeId
      : undefined;
  const updateInspection = (nodeId?: string, edgeId?: string) =>
    setInspection({
      tableIdentity,
      occurrenceId: selectedOccurrenceId,
      nodeId,
      edgeId,
    });
  const selectEdge = (edgeId?: string) =>
    updateInspection(activeInspectedNodeId, edgeId);
  const occurrences = useMemo(
    () =>
      derivedOccurrences(table, catalog).map((occurrence) => ({
        occurrenceId: occurrence.id,
        index: occurrence.index,
        nodeId: occurrence.nodeId,
        resourceType:
          catalog.nodes.find((node) => node.nodeId === occurrence.nodeId)
            ?.resourceType ?? occurrence.nodeId,
        incomingEdgeId: occurrence.incomingEdgeId,
        parentId: occurrence.parentId,
        depth: occurrence.depth,
      })),
    [catalog, table],
  );
  const traversalIdentity = `${isExpanded}:${occurrences.map((occurrence) => occurrence.occurrenceId).join(',')}`;
  const isTraversalOverflowing = useTraversalOverflow(
    graphHostRef,
    traversalRef,
    traversalIdentity,
  );
  const occurrencesByNode = useMemo(() => {
    const result = new Map<string, typeof occurrences>();
    occurrences.forEach((occurrence) => {
      result.set(occurrence.nodeId, [
        ...(result.get(occurrence.nodeId) ?? []),
        occurrence,
      ]);
    });
    return result;
  }, [occurrences]);
  const legalNextEdges = useMemo(
    () => legalOutgoingEdges(catalog, table, selectedOccurrenceId),
    [catalog, selectedOccurrenceId, table],
  );
  const legalNextNodeIds = useMemo(
    () => new Set(legalNextEdges.map((edge) => edge.toNodeId)),
    [legalNextEdges],
  );
  const nodes: Node[] = catalog.nodes.map((node, index) => {
    const nodeOccurrences = occurrencesByNode.get(node.nodeId) ?? [];
    const inRoute = nodeOccurrences.length > 0;
    const isPendingRowStart =
      occurrences.length === 0 &&
      node.rowRootEligible &&
      activeInspectedNodeId === node.nodeId;
    const isSelected =
      isPendingRowStart ||
      nodeOccurrences.some(
        (occurrence) => occurrence.occurrenceId === selectedOccurrenceId,
      );
    const isInspected =
      !isPendingRowStart && activeInspectedNodeId === node.nodeId;
    const isReachable = legalNextNodeIds.has(node.nodeId);
    const canStart = occurrences.length === 0 && node.rowRootEligible;
    const duplicate =
      catalog.nodes.filter(
        (candidate) => candidate.resourceType === node.resourceType,
      ).length > 1;
    return {
      id: node.nodeId,
      position: layout.positions.get(node.nodeId) ?? {
        x: (index % 4) * 210,
        y: Math.floor(index / 4) * 100,
      },
      data: {
        label: (
          <div className="min-w-0 px-2 py-1 text-left">
            <div className="truncate text-sm font-semibold text-slate-900">
              {node.resourceType}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {isSelected
                ? 'Editing this query node'
                : isInspected
                  ? 'Selected resource'
                  : inRoute
                    ? 'In traversal'
                    : canStart
                      ? 'Available row start'
                      : occurrences.length === 0
                        ? 'Not eligible as a row start'
                        : isReachable
                          ? 'Click to add to query'
                          : node.rowRootEligible
                            ? 'Click to start a new query'
                            : 'Available resource'}
            </div>
            {duplicate && (
              <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                {node.nodeId.slice(-8)}
              </div>
            )}
            {nodeOccurrences.length > 1 && (
              <div className="mt-0.5 text-[10px] font-semibold text-violet-700">
                {nodeOccurrences.length} query occurrences
              </div>
            )}
            <div className="mt-1 text-[10px] text-slate-500">
              {node.rowGrain ?? 'row grain unavailable'} ·{' '}
              {node.populated ? node.documentCount.toLocaleString() : '0'}{' '}
              documents
            </div>
          </div>
        ),
      },
      style: {
        border: isSelected
          ? '3px solid #7c3aed'
          : isInspected
            ? '3px solid #f59e0b'
            : inRoute
              ? '3px solid #2f5aac'
              : isReachable
                ? '3px solid #16a34a'
                : '1px solid #94a3b8',
        borderRadius: 12,
        background: isSelected
          ? '#f3e8ff'
          : isInspected
            ? '#fffbeb'
            : inRoute
              ? '#dbeafe'
              : isReachable
                ? '#f0fdf4'
                : '#ffffff',
        boxShadow:
          isSelected || isInspected || inRoute || isReachable
            ? '0 8px 24px rgba(30,64,175,.18)'
            : '0 3px 10px rgba(15,23,42,.08)',
        opacity: isSelected || isInspected || inRoute || isReachable ? 1 : 0.42,
        padding: 8,
        width: 190,
        cursor: disabled ? 'default' : 'pointer',
        pointerEvents: disabled ? 'none' : 'auto',
      },
    };
  });
  const edges: Edge[] = catalog.edges.map((edge) => {
    const isRouteEdge = occurrences.some(
      (occurrence) => occurrence.incomingEdgeId === edge.edgeId,
    );
    const isLegalNextEdge = legalNextEdges.some(
      (candidate) => candidate.edgeId === edge.edgeId,
    );
    const edgeColor = isRouteEdge
      ? '#2563eb'
      : isLegalNextEdge
        ? '#16a34a'
        : '#64748b';
    const edgeWidth = isRouteEdge ? 3 : isLegalNextEdge ? 2.5 : 1.75;
    return {
      id: edge.edgeId,
      // Loom's catalog edges are directed. Keep the catalog orientation in
      // React Flow; do not synthesize a reverse edge for FHIR relationships.
      source: edge.fromNodeId,
      target: edge.toNodeId,
      label: edge.label,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
        width: 16,
        height: 16,
        strokeWidth: 1.5,
      },
      animated: isRouteEdge,
      style: {
        stroke: edgeColor,
        strokeWidth: edgeWidth,
        opacity: isRouteEdge
          ? 1
          : occurrences.length === 0 || isLegalNextEdge
            ? 0.7
            : 0.28,
      },
      labelStyle: {
        fill: '#475569',
        fontSize: 9,
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.9,
      },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
    };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const connectedNodeIds = new Set(
    edges.flatMap((edge) =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
        ? [edge.source, edge.target]
        : [],
    ),
  );
  const catalogNodes = showOrphans
    ? nodes
    : nodes.filter((node) => connectedNodeIds.has(node.id));
  const catalogNodeIds = new Set(catalogNodes.map((node) => node.id));
  const catalogEdges = edges.filter(
    (edge) =>
      catalogNodeIds.has(edge.source) && catalogNodeIds.has(edge.target),
  );
  const nodesForViewport = catalogNodes;
  const graphIdentity = `${layout.identity ?? 'layout-pending'}:${nodesForViewport.map((node) => node.id).join(',')}`;
  const inspectNode = (nodeId: string) => {
    if (disabled) return;
    updateInspection(nodeId);
    if (occurrences.length === 0) {
      const node = catalog.nodes.find(
        (candidate) => candidate.nodeId === nodeId,
      );
      if (node?.rowRootEligible) onSetBase(nodeId);
      return;
    }
    const routeOccurrences = occurrences.filter(
      (occurrence) => occurrence.nodeId === nodeId,
    );
    if (routeOccurrences.length === 1) {
      onSelectOccurrence(routeOccurrences[0].occurrenceId);
      return;
    } else if (routeOccurrences.length > 1) {
      const currentIndex = routeOccurrences.findIndex(
        (occurrence) => occurrence.occurrenceId === selectedOccurrenceId,
      );
      const next =
        routeOccurrences[(currentIndex + 1) % routeOccurrences.length];
      onSelectOccurrence(next.occurrenceId);
      return;
    }
    const matchingEdges = legalNextEdges.filter(
      (edge) => edge.toNodeId === nodeId,
    );
    if (matchingEdges.length === 1) {
      onAppendEdge(selectedOccurrenceId, matchingEdges[0].edgeId, nodeId);
    }
  };
  const inspectEdge = (edgeId: string) => {
    if (disabled) return;
    const edge = catalog.edges.find((candidate) => candidate.edgeId === edgeId);
    if (!edge) return;
    updateInspection(edge.toNodeId, edgeId);
    const routeOccurrence = occurrences
      .filter((occurrence) => occurrence.nodeId === edge.toNodeId)
      .at(-1);
    if (routeOccurrence) onSelectOccurrence(routeOccurrence.occurrenceId);
  };
  const useAsRowStart = (nodeId: string) => {
    if (disabled) return;
    onSetBase(nodeId);
    selectEdge(undefined);
  };
  const addRelationship = (edgeId: string, nodeId: string) => {
    if (disabled || !legalNextEdges.some((edge) => edge.edgeId === edgeId))
      return;
    onAppendEdge(selectedOccurrenceId, edgeId, nodeId);
    selectEdge(undefined);
  };
  const content = (
    <>
      {isExpanded && <div className="fixed inset-0 z-40 bg-slate-950/30" />}
      <section
        role={isExpanded ? 'dialog' : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? 'Expanded dataset graph' : undefined}
        className={`flex min-w-0 flex-col p-3 ${isExpanded ? 'fixed inset-3 z-50 h-[calc(100dvh-1.5rem)] min-h-0 rounded-xl border border-slate-200 bg-white shadow-xl' : 'relative h-[min(70dvh,52rem)] min-h-[43rem] bg-white/60'}`}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              Dataset graph{' '}
              <span className="ml-1 text-xs font-normal text-slate-400">
                {catalog.nodes.length} resources · {catalog.edges.length}{' '}
                relationships
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              ref={onTableToolbarHostChange}
              id="explorer-builder-table-toolbar-host"
              className="min-w-0"
            />
            {isExpanded && (
              <button
                type="button"
                className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                onClick={() => setIsExpanded(false)}
              >
                Close graph
              </button>
            )}
          </div>
        </div>
        <div
          ref={graphHostRef}
          className={`relative mt-2 min-h-0 flex-1 overflow-hidden rounded-lg bg-slate-100/70 ${isExpanded ? '' : 'min-h-[32rem]'}`}
        >
          <ReactFlow
            nodes={nodesForViewport}
            edges={catalogEdges}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            onInit={(instance) => {
              void instance.fitView({
                padding: 0.08,
                minZoom: 0.05,
                maxZoom: 1.8,
                duration: 200,
              });
            }}
            onNodeClick={(event, node) => {
              event.stopPropagation();
              inspectNode(node.id);
            }}
            onEdgeClick={(event, edge) => {
              event.stopPropagation();
              inspectEdge(edge.id);
            }}
            onPaneClick={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest('.react-flow__node, .react-flow__edge')
              )
                return;
              if (!isExpanded) setIsExpanded(true);
            }}
          >
            <GraphViewportFitter
              expanded={isExpanded}
              graphIdentity={graphIdentity}
              hostRef={graphHostRef}
              nodeCount={nodesForViewport.length}
            />
            <Background color="#cbd5e1" gap={28} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
          <RouteExtensionPanel
            catalog={catalog}
            table={table}
            selectedOccurrenceId={selectedOccurrenceId}
            inspectedNodeId={activeInspectedNodeId}
            selectedEdgeId={activeSelectedEdgeId}
            disabled={disabled}
            onSelectEdge={selectEdge}
            onUseAsRowStart={useAsRowStart}
            onChangeRowStart={onChangeBase}
            onAddEdge={addRelationship}
          />
          <nav
            ref={traversalRef}
            aria-label="Current traversal"
            className={`absolute left-3 top-3 z-10 flex w-fit max-w-[calc(100%-9rem)] items-center gap-2 overflow-x-auto rounded-lg border border-blue-200 bg-blue-50/95 px-2 py-1.5 text-xs shadow-sm ${isTraversalOverflowing ? 'group transition-[max-width] hover:max-w-[calc(100%-1.5rem)]' : ''}`}
          >
            <div className="shrink-0 border-r border-blue-200 pr-2">
              <p className="font-semibold text-blue-950">Current query</p>
              <p
                data-traversal-label
                className={`${isTraversalOverflowing ? 'max-w-28 truncate group-hover:max-w-48' : ''} text-[10px] text-blue-600`}
              >
                Selected parent:{' '}
                {occurrences.find(
                  (occurrence) =>
                    occurrence.occurrenceId === selectedOccurrenceId,
                )?.resourceType ?? 'none'}
              </p>
            </div>
            {occurrences.length === 0 ? (
              <span className="shrink-0 text-blue-950">
                Click a resource to start.
              </span>
            ) : (
              <div className="flex min-w-max items-center gap-1">
                {occurrences.map((occurrence) => (
                  <div
                    key={occurrence.occurrenceId}
                    className="flex items-center gap-1.5"
                  >
                    {occurrence.depth > 0 && (
                      <span className="font-bold text-blue-400">↳</span>
                    )}
                    <button
                      type="button"
                      title={occurrence.resourceType}
                      data-traversal-label
                      className={`${isTraversalOverflowing ? 'max-w-24 truncate transition-[max-width] group-hover:max-w-40' : ''} rounded-md border px-2 py-1 font-semibold ${occurrence.occurrenceId === selectedOccurrenceId ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-blue-300 bg-white text-blue-900'}`}
                      onClick={() =>
                        onSelectOccurrence(occurrence.occurrenceId)
                      }
                    >
                      {occurrence.resourceType}
                    </button>
                    {occurrence.occurrenceId !== 'base' && (
                      <button
                        type="button"
                        aria-label={`Remove ${occurrence.resourceType} branch`}
                        title={`Remove ${occurrence.resourceType} branch`}
                        className="rounded-full px-1.5 py-0.5 text-base leading-none text-blue-500 hover:bg-blue-100 hover:text-red-600"
                        onClick={() => onTruncate(occurrence.occurrenceId)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </nav>
          <label className="absolute right-3 top-3 z-10 flex cursor-pointer items-center gap-1.5 rounded border border-slate-300 bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
              checked={showOrphans}
              onChange={(event) => setShowOrphans(event.target.checked)}
              aria-label="Show orphans"
            />
            Show orphans
          </label>
        </div>
      </section>
    </>
  );
  return isExpanded && typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
};
