import React, { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { ExplorerBuilderCatalog } from '@gen3/core';
import { derivedOccurrences, type DraftTable } from '../authoring/model';
import { legalOutgoingEdges } from '../authoring/routeActions';
import { layoutDatasetGraph } from '../graphLayout';
import { RouteExtensionPanel } from './RouteExtensionPanel';

const GraphViewportFitter = ({
  expanded,
  graphIdentity,
  focusRoute,
  hostRef,
  nodeCount,
}: {
  readonly expanded: boolean;
  readonly graphIdentity: string;
  readonly focusRoute: boolean;
  readonly hostRef: React.RefObject<HTMLDivElement | null>;
  readonly nodeCount: number;
}) => {
  const flow = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const viewportInitialized = flow.viewportInitialized;

  useEffect(() => {
    const host = hostRef.current;
    if (
      !host ||
      !nodesInitialized ||
      !viewportInitialized ||
      nodeCount === 0
    )
      return undefined;

    let firstFrame = 0;
    let secondFrame = 0;
    const fit = () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      firstFrame = window.requestAnimationFrame(() => {
        // React Flow measures node dimensions after paint. Waiting a second
        // frame ensures fitView sees the same positioned nodes that are on
        // screen instead of fitting the previous/fallback layout.
        secondFrame = window.requestAnimationFrame(() => {
          void flow.fitView({
            padding: focusRoute ? 0.2 : 0.08,
            minZoom: 0.05,
            maxZoom: 1.8,
            duration: 200,
          });
        });
      });
    };

    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
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
    focusRoute,
    graphIdentity,
    hostRef,
    nodeCount,
    nodesInitialized,
    viewportInitialized,
  ]);

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
}: {
  readonly catalog: ExplorerBuilderCatalog;
  readonly table?: DraftTable;
  readonly selectedOccurrenceId: string;
  readonly disabled: boolean;
  readonly onSelectOccurrence: (id: string) => void;
  readonly onSetBase: (nodeId: string) => void;
  readonly onChangeBase: (nodeId: string) => void;
  readonly onAppendEdge: (edgeId: string, nodeId: string) => void;
  readonly onTruncate: (occurrenceId: string) => void;
}) => {
  const graphHostRef = React.useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<
    ReadonlyMap<string, { x: number; y: number }>
  >(new Map());
  const [layoutIdentity, setLayoutIdentity] = useState<string>();
  const [inspectedNodeId, setInspectedNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOrphans, setShowOrphans] = useState(false);
  // Keep the catalog visible when opening an existing table. Route focus is a
  // useful opt-in inspection mode, but hiding the rest of the catalog makes
  // the Builder look like it has only one or two available resources.
  const [focusRoute, setFocusRoute] = useState(false);
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
  useEffect(() => {
    let active = true;
    setPositions(new Map());
    setLayoutIdentity(undefined);
    void layoutDatasetGraph(
      catalog.nodes.map((node) => ({
        id: node.nodeId,
        width: 170,
        height: 54,
      })),
      catalog.edges.map((edge) => ({
        id: edge.edgeId,
        source: edge.fromNodeId,
        target: edge.toNodeId,
      })),
    )
      .then((value) => {
        if (!active) return;
        setPositions(value.positions);
        setLayoutIdentity(catalogIdentity);
      })
      .catch(() => {
        // The deterministic positions below keep the graph usable if a
        // malformed relationship prevents ELK from laying out the catalog.
        if (active) setLayoutIdentity(catalogIdentity);
      });
    return () => {
      active = false;
    };
  }, [catalog, catalogIdentity]);
  useEffect(() => {
    setInspectedNodeId(undefined);
    setSelectedEdgeId(undefined);
    setFocusRoute(false);
  }, [table?.rootNodeId, table?.outputId]);
  useEffect(() => {
    if (!isExpanded) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isExpanded]);
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
      })),
    [catalog, table],
  );
  const occurrenceByNode = useMemo(
    () =>
      new Map(occurrences.map((occurrence) => [occurrence.nodeId, occurrence])),
    [occurrences],
  );
  const tailNodeId = occurrences.at(-1)?.nodeId;
  const legalNextEdges = useMemo(
    () =>
      table?.rootNodeId && tailNodeId ? legalOutgoingEdges(catalog, table) : [],
    [catalog, table, tailNodeId],
  );
  const legalNextNodeIds = useMemo(
    () => new Set(legalNextEdges.map((edge) => edge.toNodeId)),
    [legalNextEdges],
  );
  const focusedNodeIds = useMemo(() => {
    const ids = new Set(occurrences.map((occurrence) => occurrence.nodeId));
    legalNextEdges.forEach((edge) => {
      ids.add(edge.fromNodeId);
      ids.add(edge.toNodeId);
    });
    return ids;
  }, [legalNextEdges, occurrences]);
  const nodes: Node[] = catalog.nodes.map((node, index) => {
    const occurrence = occurrenceByNode.get(node.nodeId);
    const inRoute = Boolean(occurrence);
    const isSelected = occurrence?.occurrenceId === selectedOccurrenceId;
    const isReachable = legalNextNodeIds.has(node.nodeId);
    const canStart = !table?.rootNodeId && node.rowRootEligible;
    const duplicate =
      catalog.nodes.filter(
        (candidate) => candidate.resourceType === node.resourceType,
      ).length > 1;
    return {
      id: node.nodeId,
      position: positions.get(node.nodeId) ?? {
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
                ? 'Selected occurrence'
                : inRoute
                  ? 'In traversal'
                  : canStart
                    ? 'Available row start'
                    : !table?.rootNodeId
                      ? 'Not eligible as a row start'
                    : isReachable
                      ? 'Available next step'
                      : 'Not reachable from current tail'}
            </div>
            {duplicate && (
              <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                {node.nodeId.slice(-8)}
              </div>
            )}
            <div className="mt-1 text-[10px] text-slate-500">
              {node.rowGrain ?? 'row grain unavailable'} ·{' '}
              {node.populated ? node.documentCount.toLocaleString() : '0'} documents
            </div>
          </div>
        ),
      },
      style: {
        border: isSelected
          ? '3px solid #7c3aed'
          : inRoute
            ? '3px solid #2f5aac'
            : isReachable
              ? '3px solid #16a34a'
              : '1px solid #94a3b8',
        borderRadius: 12,
        background: isSelected
          ? '#f3e8ff'
          : inRoute
            ? '#dbeafe'
            : isReachable
              ? '#f0fdf4'
              : '#ffffff',
        boxShadow:
          isSelected || inRoute || isReachable
            ? '0 8px 24px rgba(30,64,175,.18)'
            : '0 3px 10px rgba(15,23,42,.08)',
        opacity: isSelected || inRoute || isReachable ? 1 : 0.42,
        padding: 8,
        width: 190,
        cursor: disabled ? 'default' : 'pointer',
        pointerEvents: disabled ? 'none' : 'auto',
      },
    };
  });
  const edges: Edge[] = catalog.edges.map((edge) => {
    const isRouteEdge = table?.routeSteps.some(
      (step) => step.edgeId === edge.edgeId,
    ) ?? false;
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
          : !table?.rootNodeId || isLegalNextEdge
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
  const routeNodes =
    focusRoute && focusedNodeIds.size
      ? catalogNodes.filter((node) => focusedNodeIds.has(node.id))
      : catalogNodes;
  // A stale route identity must not blank the graph. Fall back to the
  // connected catalog, while still keeping orphan visibility opt-in.
  const nodesForViewport = routeNodes.length > 0 ? routeNodes : catalogNodes;
  const visibleNodeIds = new Set(routeNodes.map((node) => node.id));
  const visibleEdges =
    focusRoute && focusedNodeIds.size && routeNodes.length > 0
      ? catalogEdges.filter(
          (edge) =>
            visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
        )
      : catalogEdges;
  const graphIdentity = `${layoutIdentity ?? 'layout-pending'}:${focusRoute ? 'focus' : 'full'}:${nodesForViewport.map((node) => node.id).join(',')}`;
  const inspectNode = (nodeId: string) => {
    if (disabled) return;
    setInspectedNodeId(nodeId);
    setSelectedEdgeId(undefined);
    const routeOccurrence = occurrences
      .filter((occurrence) => occurrence.nodeId === nodeId)
      .at(-1);
    if (routeOccurrence) onSelectOccurrence(routeOccurrence.occurrenceId);
  };
  const inspectEdge = (edgeId: string) => {
    if (disabled) return;
    const edge = catalog.edges.find((candidate) => candidate.edgeId === edgeId);
    if (!edge) return;
    setInspectedNodeId(edge.toNodeId);
    setSelectedEdgeId(edgeId);
    const routeOccurrence = occurrences
      .filter((occurrence) => occurrence.nodeId === edge.toNodeId)
      .at(-1);
    if (routeOccurrence) onSelectOccurrence(routeOccurrence.occurrenceId);
  };
  const useAsRowStart = (nodeId: string) => {
    if (disabled) return;
    onSetBase(nodeId);
    setSelectedEdgeId(undefined);
  };
  const addRelationship = (edgeId: string, nodeId: string) => {
    if (disabled || !legalNextEdges.some((edge) => edge.edgeId === edgeId))
      return;
    onAppendEdge(edgeId, nodeId);
    setSelectedEdgeId(undefined);
  };
  return (
    <>
      {isExpanded && <div className="fixed inset-0 z-40 bg-slate-950/30" />}
      <section
        role={isExpanded ? 'dialog' : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? 'Expanded dataset graph' : undefined}
        className={`relative flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${isExpanded ? 'fixed inset-3 z-50 h-[calc(100dvh-1.5rem)] min-h-0' : 'h-[min(70dvh,52rem)] min-h-[43rem]'}`}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dataset graph
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Arrows show each catalog relationship from source to target.
              Inspect nodes freely; route changes happen only from the controls
              below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
              {catalog.nodes.length} resources · {catalog.edges.length}{' '}
              relationships
            </span>
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setFocusRoute((value) => !value)}
            >
              {focusRoute ? 'Show full graph' : 'Focus route'}
            </button>
            <button
              type="button"
              className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
              onClick={() => setIsExpanded((value) => !value)}
            >
              {isExpanded ? 'Close graph' : 'Expand graph'}
            </button>
          </div>
        </div>
        <nav
          aria-label="Current traversal"
          className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-2 py-1.5 text-xs"
        >
          <span className="mr-1 font-semibold uppercase tracking-wide text-blue-800">
            Traversal
          </span>
          {occurrences.length === 0 ? (
            <span className="text-blue-950">
              Choose a base resource in the graph.
            </span>
          ) : (
            occurrences.map((occurrence, index) => (
              <React.Fragment key={occurrence.occurrenceId}>
                {index > 0 && (
                  <span className="font-bold text-blue-500">→</span>
                )}
                <button
                  type="button"
                  className={`rounded-md border px-2 py-1 font-semibold ${occurrence.occurrenceId === selectedOccurrenceId ? 'border-blue-500 bg-white text-blue-950 shadow-sm' : 'border-blue-300 bg-white text-blue-900'}`}
                  onClick={() => onSelectOccurrence(occurrence.occurrenceId)}
                >
                  <span className="mr-1 text-blue-500">{index + 1}</span>
                  {occurrence.resourceType}
                </button>
                {index > 0 && index === occurrences.length - 1 && (
                  <button
                    type="button"
                    className="rounded-md border-l border-blue-200 px-2 py-1 text-blue-700 hover:bg-blue-100"
                    onClick={() => onTruncate(occurrence.occurrenceId)}
                  >
                    Remove from here
                  </button>
                )}
              </React.Fragment>
            ))
          )}
        </nav>
        <RouteExtensionPanel
          catalog={catalog}
          table={table}
          inspectedNodeId={inspectedNodeId}
          selectedEdgeId={selectedEdgeId}
          disabled={disabled}
          onSelectEdge={setSelectedEdgeId}
          onUseAsRowStart={useAsRowStart}
          onChangeRowStart={onChangeBase}
          onAddEdge={addRelationship}
        />
        <div
          ref={graphHostRef}
          className={`relative mt-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner ${isExpanded ? '' : 'min-h-[32rem]'}`}
        >
          <ReactFlow
            nodes={nodesForViewport}
            edges={routeNodes.length > 0 ? visibleEdges : catalogEdges}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            onInit={(instance) => {
              void instance.fitView({
                padding: focusRoute ? 0.2 : 0.08,
                minZoom: 0.05,
                maxZoom: 1.8,
                duration: 200,
              });
            }}
            onNodeClick={(_event, node) => inspectNode(node.id)}
            onEdgeClick={(_event, edge) => inspectEdge(edge.id)}
          >
            <GraphViewportFitter
              expanded={isExpanded}
              graphIdentity={graphIdentity}
              focusRoute={focusRoute}
              hostRef={graphHostRef}
              nodeCount={nodesForViewport.length}
            />
            <Background color="#cbd5e1" gap={28} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
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
};
