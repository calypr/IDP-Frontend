import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  useCompileExplorerBuilderV2Mutation,
  useCreateExplorerAuthoringMutation,
  useGetExplorerAuthoringCapabilityV2Query,
  useGetExplorerAuthoringExplorersQuery,
  useGetExplorerBuilderStateV2Query,
  useGetExplorerCandidateSuggestionsV2Mutation,
  usePreviewExplorerAuthoringV2Mutation,
  usePublishExplorerAuthoringV2Mutation,
} from '@gen3/core';
import type {
  ExplorerAuthoringApiError,
  ExplorerAuthoringDiagnostic,
  ExplorerBuilderCatalog,
} from '@gen3/core';
import { BuilderToolbar } from './components/BuilderToolbar';
import { GuidedGraphWorkspace } from './components/GuidedGraphWorkspace';
import {
  ColumnSelector,
  columnFromCandidate,
} from './components/ColumnSelector';
import { PreviewTable } from './components/PreviewTable';
import {
  derivedOccurrences,
  intentFingerprint,
  nextRouteOccurrenceId,
  routeNode,
  routeSubtreeOccurrenceIds,
  selectedTable,
  workspaceFromState,
  type BuilderAuthoringState,
  type DraftTable,
} from './authoring/model';
import { builderAuthoringReducer } from './authoring/reducer';
import {
  lowerPreviewLimit,
  previewRecoveryAction,
  type PreviewLimit,
} from './authoring/previewRecovery';

const emptyCatalog = (): ExplorerBuilderCatalog => ({
  snapshotToken: '',
  generation: '',
  routePolicy: {},
  nodes: [],
  edges: [],
  candidates: [],
});
const emptyBuilderState = (project: string): BuilderAuthoringState => ({
  project,
  explorerId: 'default',
  catalog: emptyCatalog(),
  workspace: null,
  tables: [],
  selectedOccurrenceId: 'base',
  diagnostics: [],
  dirty: false,
  reconciliation: 'idle',
});

const diagnosticsFromError = (
  error: unknown,
): ReadonlyArray<ExplorerAuthoringDiagnostic> => {
  const value = error as ExplorerAuthoringApiError | undefined;
  if (value?.diagnostics?.length) return value.diagnostics;
  return [
    {
      severity: 'error',
      code: value?.code ?? 'EXPLORER_AUTHORING_FAILED',
      message: value?.message ?? 'Loom could not process the Builder request.',
      requestId: value?.requestId,
    },
  ];
};
const isStaleSnapshot = (code: string | undefined) =>
  [
    'STALE_CATALOG_SNAPSHOT',
    'STALE_SNAPSHOT',
    'SNAPSHOT_STALE',
    'STALE_RECEIPT',
    'RECEIPT_STALE',
    'COMPILE_RECEIPT_NOT_FOUND',
    'RECEIPT_RECOMPILE_REQUIRED',
  ].includes(code ?? '');
const opaqueId = (prefix: 'output' | 'tab' | 'step') =>
  `${prefix}-${window.crypto.randomUUID()}`;

const BuilderWorkspace = ({
  organization,
  project,
}: {
  readonly organization: string;
  readonly project: string;
}) => {
  const projectId = `${organization}/${project}`;
  const authResourcePath = `/programs/${organization}/projects/${project}`;
  const [selectedExplorerId, setSelectedExplorerId] = useState('default');
  const explorers = useGetExplorerAuthoringExplorersQuery({
    project: projectId,
    authResourcePath,
  });
  const builder = useGetExplorerBuilderStateV2Query({
    project: projectId,
    explorerId: selectedExplorerId,
    authResourcePath,
  });
  const refetchBuilder = builder.refetch;
  const capabilities = useGetExplorerAuthoringCapabilityV2Query({
    project: projectId,
    explorerId: selectedExplorerId,
    authResourcePath,
  });
  const [createExplorer, createStatus] = useCreateExplorerAuthoringMutation();
  const [compileBuilder] = useCompileExplorerBuilderV2Mutation();
  const [getSuggestions, suggestionsStatus] =
    useGetExplorerCandidateSuggestionsV2Mutation();
  const [previewBuilder, previewStatus] =
    usePreviewExplorerAuthoringV2Mutation();
  const [publishBuilder, publishStatus] =
    usePublishExplorerAuthoringV2Mutation();
  const [state, dispatch] = useReducer(
    builderAuthoringReducer,
    projectId,
    emptyBuilderState,
  );
  const [message, setMessage] = useState<string>();
  const [previewLimit, setPreviewLimit] = useState<PreviewLimit>(25);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const [tableToolbarHost, setTableToolbarHost] = useState<HTMLElement | null>(
    null,
  );
  const hydratedKey = useRef('');
  const preserveDraftOnRefetch = useRef(false);
  const compileGeneration = useRef(0);
  const activeCompile = useRef<{ abort: () => void } | undefined>(undefined);
  const pendingPreview = useRef<
    | {
        outputId: string;
        limit: PreviewLimit;
        fingerprint: string;
        receiptRefreshes: number;
      }
    | undefined
  >(undefined);
  const latestState = useRef(state);
  const pendingClone = useRef<
    { explorerId: string; tables: ReadonlyArray<DraftTable> } | undefined
  >(undefined);
  latestState.current = state;

  useEffect(() => {
    const nextToolbarHost = document.getElementById(
      'explorer-builder-toolbar-host',
    );
    const nextTableToolbarHost = document.getElementById(
      'explorer-builder-table-toolbar-host',
    );
    if (nextToolbarHost !== toolbarHost) setToolbarHost(nextToolbarHost);
    if (nextTableToolbarHost !== tableToolbarHost)
      setTableToolbarHost(nextTableToolbarHost);
  }, [tableToolbarHost, toolbarHost]);

  useEffect(() => {
    if (!builder.data) return;
    const key = `${selectedExplorerId}:${builder.data.catalog.snapshotToken}:${JSON.stringify(
      builder.data.workspace,
    )}`;
    if (preserveDraftOnRefetch.current) {
      preserveDraftOnRefetch.current = false;
      hydratedKey.current = key;
      dispatch({ type: 'catalogRefreshed', catalog: builder.data.catalog });
      return;
    }
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    dispatch({
      type: 'hydrate',
      value: builder.data,
      explorerId: selectedExplorerId,
    });
    const clone = pendingClone.current;
    if (clone?.explorerId === selectedExplorerId) {
      clone.tables.forEach((table) =>
        dispatch({
          type: 'addTable',
          table: {
            ...table,
            document: {
              ...table.document,
              columns: [...table.document.columns],
            },
          },
        }),
      );
      pendingClone.current = undefined;
    }
  }, [builder.data, selectedExplorerId]);

  const workspace = useMemo(() => workspaceFromState(state), [state]);
  const fingerprint = useMemo(() => intentFingerprint(workspace), [workspace]);
  const incomplete = state.tables.some(
    (table) => !table.document.rootResourceType,
  );

  useEffect(() => {
    if (!state.dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  useEffect(() => {
    if (
      state.reconciliation !== 'pending' ||
      !state.catalog.snapshotToken ||
      state.tables.length === 0 ||
      incomplete
    )
      return;
    const generation = ++compileGeneration.current;
    const submittedFingerprint = fingerprint;
    const submittedSnapshot = state.catalog.snapshotToken;
    const timer = window.setTimeout(() => {
      const submit = (attempt: number): void => {
        const request = compileBuilder({
          project: projectId,
          explorerId: state.explorerId,
          authResourcePath,
          workspace,
          snapshotToken: submittedSnapshot,
          requestId: `builder-${generation}-${attempt}`,
        });
        activeCompile.current = request;
        void request
          .unwrap()
          .then((value) => {
            if (generation !== compileGeneration.current) return;
            const current = latestState.current;
            if (
              current.catalog.snapshotToken !== submittedSnapshot ||
              intentFingerprint(workspaceFromState(current)) !==
                submittedFingerprint
            )
              return;
            dispatch({ type: 'compiled', value });
          })
          .catch(async (error: ExplorerAuthoringApiError) => {
            if (
              generation !== compileGeneration.current ||
              error.code === 'CLIENT_CANCELLED'
            )
              return;
            if (isStaleSnapshot(error.code)) {
              preserveDraftOnRefetch.current = true;
              const refreshed = await refetchBuilder();
              if (refreshed.data) {
                dispatch({
                  type: 'catalogRefreshed',
                  catalog: refreshed.data.catalog,
                });
                setMessage(undefined);
              }
              return;
            }
            if (error.retryable && attempt < 2) {
              window.setTimeout(() => submit(attempt + 1), 250);
              return;
            }
            dispatch({
              type: 'repair',
              diagnostics: diagnosticsFromError(error),
            });
          });
      };
      submit(1);
    }, 450);
    return () => {
      window.clearTimeout(timer);
      activeCompile.current?.abort();
      activeCompile.current = undefined;
    };
  }, [
    authResourcePath,
    compileBuilder,
    fingerprint,
    incomplete,
    projectId,
    refetchBuilder,
    state.catalog.snapshotToken,
    state.explorerId,
    state.reconciliation,
    state.tables.length,
    workspace,
  ]);

  const table = selectedTable(state);
  const occurrences = useMemo(
    () => derivedOccurrences(table, state.catalog),
    [state.catalog, table],
  );
  const occurrence = occurrences.find(
    (candidate) => candidate.id === state.selectedOccurrenceId,
  );

  useEffect(() => {
    if (!occurrence || !state.catalog.snapshotToken) return;
    if (
      (state.catalog.candidates ?? []).some(
        (candidate) => candidate.nodeId === occurrence.nodeId,
      )
    )
      return;
    const request = getSuggestions({
      project: projectId,
      explorerId: state.explorerId,
      authResourcePath,
      snapshotToken: state.catalog.snapshotToken,
      nodeId: occurrence.nodeId,
      requestId: `suggestions-${occurrence.id}`,
    });
    void request
      .unwrap()
      .then((value) => {
        if (value.snapshotToken === latestState.current.catalog.snapshotToken) {
          dispatch({ type: 'candidatesLoaded', candidates: value.candidates });
        }
      })
      .catch((error: ExplorerAuthoringApiError) => {
        if (error.code !== 'CLIENT_CANCELLED') {
          const suffix = error.code ? ` (${error.code})` : '';
          setMessage(
            `Available columns could not be loaded: ${error.message}${suffix}`,
          );
        }
      });
    return () => request.abort();
  }, [
    authResourcePath,
    getSuggestions,
    occurrence,
    projectId,
    state.catalog.candidates,
    state.catalog.snapshotToken,
    state.explorerId,
  ]);
  const busy =
    previewStatus.isLoading ||
    publishStatus.isLoading ||
    createStatus.isLoading;
  const blockingDiagnostics = state.diagnostics.some(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const hasVisibleSelectedColumn = Boolean(
    table?.document.columns.some(
      (column) => column.table?.visible ?? Boolean(column.table),
    ),
  );
  const previewDisabled =
    !table?.document.rootResourceType ||
    !hasVisibleSelectedColumn ||
    blockingDiagnostics;
  const publishDisabled =
    !state.dirty ||
    incomplete ||
    !state.receipt ||
    state.reconciliation !== 'resolved' ||
    blockingDiagnostics ||
    state.tables.some(
      (candidate) =>
        !state.receipt?.outputs.some(
          (output) =>
            output.outputId === candidate.outputId && output.columns.length > 0,
        ),
    );

  const addTable = () => {
    const title = window.prompt('Table name')?.trim();
    if (!title) return;
    const outputId = opaqueId('output');
    dispatch({
      type: 'addTable',
      table: {
        outputId,
        tabId: opaqueId('tab'),
        title,
        document: {
          kind: 'ExplorerBuilderDocument',
          output: { id: outputId, title },
          rootResourceType: '',
          route: { occurrenceId: 'base', resourceType: '' },
          columns: [],
        },
      },
    });
  };
  const duplicateTable = () => {
    if (!table) return;
    dispatch({
      type: 'addTable',
      table: {
        ...table,
        outputId: opaqueId('output'),
        tabId: opaqueId('tab'),
        title: `${table.title} copy`,
        document: {
          ...table.document,
          columns: [...table.document.columns],
        },
      },
    });
  };
  const createCustomExplorer = async (title: string, fromCurrent: boolean) => {
    try {
      const created = await createExplorer({
        project: projectId,
        authResourcePath,
        name: title,
        title,
      }).unwrap();
      if (fromCurrent) {
        pendingClone.current = {
          explorerId: created.explorerId,
          tables: state.tables,
        };
      }
      hydratedKey.current = '';
      setSelectedExplorerId(created.explorerId);
      void explorers.refetch();
      setMessage(undefined);
    } catch (error) {
      const apiError = error as ExplorerAuthoringApiError;
      const suffix = apiError.code ? ` (${apiError.code})` : '';
      setMessage(`Explorer creation failed: ${apiError.message}${suffix}`);
    }
  };
  const executePreview = useCallback(
    async (
      request: {
        outputId: string;
        limit: PreviewLimit;
        fingerprint: string;
        receiptRefreshes: number;
      },
      receiptId: string,
    ) => {
      let limit = request.limit;
      let transientRetries = 0;
      for (;;) {
        try {
          const value = await previewBuilder({
            project: projectId,
            explorerId: latestState.current.explorerId,
            authResourcePath,
            receiptId,
            outputId: request.outputId,
            limit,
          }).unwrap();
          const current = latestState.current;
          if (
            value.receiptId !== current.receipt?.receiptId ||
            request.fingerprint !==
              intentFingerprint(workspaceFromState(current))
          )
            return;
          pendingPreview.current = undefined;
          dispatch({ type: 'preview', value });
          setMessage(undefined);
          return;
        } catch (error) {
          const apiError = error as ExplorerAuthoringApiError;
          if (apiError.code === 'CLIENT_CANCELLED') return;
          const recovery = previewRecoveryAction(apiError, {
            receiptRefreshes: request.receiptRefreshes,
            transientRetries,
            limit,
          });
          if (recovery === 'reduce-limit') {
            limit = lowerPreviewLimit(limit);
            setPreviewLimit(limit);
            continue;
          }
          if (recovery === 'retry') {
            transientRetries += 1;
            continue;
          }
          if (recovery === 'recompile') {
            pendingPreview.current = {
              ...request,
              limit,
              receiptRefreshes: request.receiptRefreshes + 1,
            };
            dispatch({ type: 'requestRecompile' });
            setMessage(undefined);
            return;
          }
          if (recovery === 'refresh-catalog') {
            pendingPreview.current = {
              ...request,
              limit,
              receiptRefreshes: request.receiptRefreshes + 1,
            };
            preserveDraftOnRefetch.current = true;
            const refreshed = await refetchBuilder();
            if (refreshed.data) {
              dispatch({
                type: 'catalogRefreshed',
                catalog: refreshed.data.catalog,
              });
              setMessage(undefined);
            } else {
              pendingPreview.current = undefined;
            }
            return;
          }
          pendingPreview.current = undefined;
          if (
            ['PLAN_TOO_EXPENSIVE', 'EXPENSIVE_PLAN'].includes(
              apiError.code ?? '',
            )
          ) {
            setMessage(
              'This plan is too expensive to preview. Remove columns or shorten the route.',
            );
          } else {
            const suffix = apiError.code ? ` (${apiError.code})` : '';
            setMessage(`Preview failed: ${apiError.message}${suffix}`);
          }
          return;
        }
      }
    },
    [authResourcePath, previewBuilder, projectId, refetchBuilder],
  );

  useEffect(() => {
    const request = pendingPreview.current;
    if (!request || state.reconciliation !== 'resolved' || !state.receipt)
      return;
    if (request.fingerprint !== fingerprint) {
      pendingPreview.current = undefined;
      return;
    }
    pendingPreview.current = undefined;
    void executePreview(request, state.receipt.receiptId);
  }, [executePreview, fingerprint, state.receipt, state.reconciliation]);

  const preview = () => {
    if (!table || previewDisabled) return;
    const request = {
      outputId: table.outputId,
      limit: previewLimit,
      fingerprint,
      receiptRefreshes: 0,
    };
    if (!state.receipt || state.reconciliation !== 'resolved') {
      pendingPreview.current = request;
      if (state.reconciliation !== 'pending')
        dispatch({ type: 'requestRecompile' });
      setMessage(undefined);
      return;
    }
    void executePreview(request, state.receipt.receiptId);
  };
  const publish = async () => {
    if (!state.receipt || publishDisabled) return;
    try {
      await publishBuilder({
        project: projectId,
        explorerId: state.explorerId,
        authResourcePath,
        receiptId: state.receipt.receiptId,
      }).unwrap();
      dispatch({ type: 'published' });
      setMessage(undefined);
    } catch (error) {
      const apiError = error as ExplorerAuthoringApiError;
      if (isStaleSnapshot(apiError.code)) {
        preserveDraftOnRefetch.current = true;
        const refreshed = await refetchBuilder();
        if (refreshed.data) {
          dispatch({
            type: 'catalogRefreshed',
            catalog: refreshed.data.catalog,
          });
          setMessage(undefined);
        }
        return;
      }
      const suffix = apiError.code ? ` (${apiError.code})` : '';
      setMessage(
        `Publication failed; the previously active Viewer revision remains available: ${apiError.message}${suffix}`,
      );
    }
  };

  if (explorers.isLoading || builder.isLoading) {
    return (
      <main className="p-6" role="status">
        Loading the selected Explorer configuration…
      </main>
    );
  }
  if (explorers.error || builder.error || !builder.data) {
    return (
      <main className="p-6" role="alert">
        Loom’s V2 Builder state could not be loaded. This Builder has no V1
        fallback.
      </main>
    );
  }

  const toolbar = (
    <BuilderToolbar
      explorers={explorers.data ?? []}
      selectedExplorerId={selectedExplorerId}
      onExplorerChange={(id) => {
        activeCompile.current?.abort();
        pendingPreview.current = undefined;
        hydratedKey.current = '';
        setSelectedExplorerId(id);
      }}
      onCreateExplorer={(title, fromCurrent) =>
        void createCustomExplorer(title, fromCurrent)
      }
      deleteSupported={capabilities.data?.features.deleteExplorer ?? false}
      tables={state.tables}
      selectedOutputId={state.selectedOutputId}
      onSelectTable={(outputId) => dispatch({ type: 'selectTable', outputId })}
      onRenameTable={(outputId, title) =>
        dispatch({ type: 'renameTable', outputId, title })
      }
      onNewTable={addTable}
      onDuplicateTable={duplicateTable}
      onDeleteTable={() =>
        table &&
        window.confirm(`Delete ${table.title}?`) &&
        dispatch({ type: 'removeTable', outputId: table.outputId })
      }
      onReorderTable={(outputId, before) =>
        dispatch({ type: 'reorderTable', outputId, before })
      }
      onPreview={() => void preview()}
      onPublish={() => void publish()}
      previewDisabled={previewDisabled}
      publishDisabled={publishDisabled}
      busy={busy}
      columnCreationSupported={false}
      tableToolbarHost={toolbarHost ? tableToolbarHost : undefined}
    />
  );

  return (
    <main className="min-h-screen bg-slate-50 p-2 pb-10 text-slate-900 sm:p-3">
      {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
      <div className="mx-auto max-w-[1920px] space-y-3">
        {(message ||
          blockingDiagnostics ||
          state.reconciliation === 'stale') && (
          <section
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900"
            role="alert"
          >
            <div className="font-semibold">
              {blockingDiagnostics
                ? 'Builder needs attention'
                : state.reconciliation === 'stale'
                  ? 'Catalog or receipt changed'
                  : 'Builder needs attention'}
            </div>
            <p>{state.diagnostics[0]?.message ?? message}</p>
            {state.diagnostics[0]?.code ? (
              <p className="mt-1">
                Technical details · Code: {state.diagnostics[0].code}
              </p>
            ) : null}
            {(state.reconciliation === 'stale' ||
              state.reconciliation === 'repair') &&
            state.tables.length > 0 &&
            !incomplete ? (
              <button
                type="button"
                className="mt-2 rounded border border-blue-300 bg-white px-2.5 py-1 font-semibold text-blue-800 hover:bg-blue-50"
                onClick={() => dispatch({ type: 'requestRecompile' })}
              >
                Recompile
              </button>
            ) : null}
          </section>
        )}
        {state.tables.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">No configured tables</h2>
            <p className="mt-1 text-sm text-slate-500">
              Load a V2 configuration with at least one table or copy an
              existing Explorer.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Interactive table and dataset-column creation is deferred from the
              configured-column MVP.
            </p>
          </section>
        ) : (
          <>
            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(28rem,0.95fr)]">
              <GuidedGraphWorkspace
                catalog={state.catalog}
                table={table}
                selectedOccurrenceId={state.selectedOccurrenceId}
                disabled={state.reconciliation === 'pending'}
                onSelectOccurrence={(occurrenceId) =>
                  dispatch({ type: 'selectOccurrence', occurrenceId })
                }
                onSetBase={(nodeId) =>
                  table &&
                  dispatch({
                    type: 'setRoot',
                    outputId: table.outputId,
                    nodeId,
                  })
                }
                onChangeBase={(nodeId) =>
                  table &&
                  window.confirm(
                    `Start a new query from ${state.catalog.nodes.find((node) => node.nodeId === nodeId)?.resourceType ?? 'this resource'}? This replaces the current ${occurrences.length}-node query and removes ${table.document.columns.length} configured columns from this local draft.`,
                  ) &&
                  dispatch({
                    type: 'changeRoot',
                    outputId: table.outputId,
                    nodeId,
                  })
                }
                onAppendEdge={(parentOccurrenceId, edgeId, nodeId) => {
                  if (!table) return;
                  const edge = state.catalog.edges.find(
                    (candidate) => candidate.edgeId === edgeId,
                  );
                  const node = state.catalog.nodes.find(
                    (candidate) => candidate.nodeId === nodeId,
                  );
                  if (!edge || !node) return;
                  dispatch({
                    type: 'addRouteChild',
                    outputId: table.outputId,
                    parentOccurrenceId,
                    edgeId,
                    occurrenceId: nextRouteOccurrenceId(
                      table.document.route,
                      parentOccurrenceId,
                      node.resourceType,
                      edge.label,
                    ),
                  });
                }}
                onTruncate={(occurrenceId) => {
                  if (!table) return;
                  const subtree = routeNode(table.document.route, occurrenceId);
                  if (!subtree) return;
                  const ids = routeSubtreeOccurrenceIds(subtree);
                  const columnCount = table.document.columns.filter((column) =>
                    ids.has(column.occurrenceId),
                  ).length;
                  if (
                    !window.confirm(
                      `Remove this local branch (${ids.size} occurrence${ids.size === 1 ? '' : 's'}, ${columnCount} column${columnCount === 1 ? '' : 's'})?`,
                    )
                  )
                    return;
                  dispatch({
                    type: 'removeRouteSubtree',
                    outputId: table.outputId,
                    occurrenceId,
                  });
                }}
              />
              <ColumnSelector
                catalog={state.catalog}
                table={table}
                occurrenceId={state.selectedOccurrenceId}
                disabled={!occurrence}
                loadingCandidates={suggestionsStatus.isLoading}
                onAdd={(candidate, displayName) =>
                  table &&
                  dispatch({
                    type: 'addColumn',
                    outputId: table.outputId,
                    value: columnFromCandidate(
                      candidate,
                      state.selectedOccurrenceId,
                      table.document.columns,
                      displayName,
                      state.catalog.nodes.find(
                        (node) => node.nodeId === candidate.nodeId,
                      )?.resourceType ?? '',
                    ),
                  })
                }
                onAddAll={(candidates) => {
                  if (!table) return;
                  const existing = [...table.document.columns];
                  const values = candidates.map((candidate) => {
                    const value = columnFromCandidate(
                      candidate,
                      state.selectedOccurrenceId,
                      existing,
                      candidate.label,
                      state.catalog.nodes.find(
                        (node) => node.nodeId === candidate.nodeId,
                      )?.resourceType ?? '',
                    );
                    existing.push(value);
                    return value;
                  });
                  dispatch({
                    type: 'addColumns',
                    outputId: table.outputId,
                    values,
                  });
                }}
                onChange={(column) =>
                  table &&
                  dispatch({
                    type: 'updateColumn',
                    outputId: table.outputId,
                    column: column.column,
                    value: column,
                  })
                }
                onRemove={(column) =>
                  table &&
                  dispatch({
                    type: 'removeColumn',
                    outputId: table.outputId,
                    column,
                  })
                }
              />
            </div>
            <PreviewTable
              preview={state.preview}
              table={table}
              limit={previewLimit}
              onLimitChange={setPreviewLimit}
              onColumnChange={(column) =>
                table &&
                dispatch({
                  type: 'updateColumn',
                  outputId: table.outputId,
                  column: column.column,
                  value: column,
                })
              }
            />
          </>
        )}
      </div>
    </main>
  );
};

export default BuilderWorkspace;
