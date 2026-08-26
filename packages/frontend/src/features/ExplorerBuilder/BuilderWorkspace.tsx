import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import { ColumnSelector } from './components/ColumnSelector';
import { PreviewTable } from './components/PreviewTable';
import { PresentationPanels } from './components/PresentationPanels';
import {
  derivedOccurrences,
  intentFingerprint,
  selectedEmissions,
  selectedTable,
  visibleEmissions,
  workspaceFromState,
  type BuilderAuthoringState,
  type DraftTable,
} from './authoring/model';
import { builderAuthoringReducer } from './authoring/reducer';

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
  tables: [],
  selectedOccurrenceId: 'base',
  emissions: [],
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
  ].includes(code ?? '');
const lowerPreviewLimit = (limit: 10 | 25 | 50 | 100) =>
  (limit === 100 ? 50 : limit === 50 ? 25 : 10) as 10 | 25 | 50 | 100;
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
  const [compileBuilder, compileStatus] =
    useCompileExplorerBuilderV2Mutation();
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
  const [previewLimit, setPreviewLimit] = useState<10 | 25 | 50 | 100>(25);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const hydratedKey = useRef('');
  const preserveDraftOnRefetch = useRef(false);
  const compileGeneration = useRef(0);
  const activeCompile = useRef<{ abort: () => void } | undefined>(undefined);
  const latestState = useRef(state);
  const pendingClone = useRef<
    { explorerId: string; tables: ReadonlyArray<DraftTable> } | undefined
  >(undefined);
  latestState.current = state;

  useEffect(
    () =>
      setToolbarHost(document.getElementById('explorer-builder-toolbar-host')),
    [],
  );

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
            routeSteps: [...table.routeSteps],
            selections: [...table.selections],
            presentation: { ...table.presentation },
          },
        }),
      );
      pendingClone.current = undefined;
    }
  }, [builder.data, selectedExplorerId]);

  const workspace = useMemo(() => workspaceFromState(state), [state]);
  const fingerprint = useMemo(
    () => intentFingerprint(workspace),
    [workspace],
  );
  const incomplete = state.tables.some((table) => !table.rootNodeId);

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
                setMessage(
                  'Loom’s catalog changed. Your edits are preserved; review them and choose Recompile.',
                );
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
  const emissions = selectedEmissions(state);

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
          dispatch({ type: 'repair', diagnostics: diagnosticsFromError(error) });
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
    compileStatus.isLoading ||
    createStatus.isLoading;
  const blockingDiagnostics = state.diagnostics.some(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const previewDisabled =
    !table?.rootNodeId ||
    visibleEmissions(state).length === 0 ||
    !state.receipt ||
    state.reconciliation !== 'resolved' ||
    blockingDiagnostics;
  const publishDisabled =
    !state.dirty ||
    incomplete ||
    !state.receipt ||
    state.reconciliation !== 'resolved' ||
    blockingDiagnostics ||
    state.tables.some(
      (candidate) =>
        !state.emissions.some(
          (emission) => emission.outputId === candidate.outputId,
        ),
    );

  const addTable = () => {
    const title = window.prompt('Table name')?.trim();
    if (!title) return;
    dispatch({
      type: 'addTable',
      table: {
        outputId: opaqueId('output'),
        tabId: opaqueId('tab'),
        title,
        routeSteps: [],
        selections: [],
        presentation: {},
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
        routeSteps: [...table.routeSteps],
        selections: [...table.selections],
        presentation: { ...table.presentation },
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
      setMessage(
        fromCurrent
          ? `Created ${title} with a copy of the complete workspace.`
          : `Created ${title}.`,
      );
    } catch (error) {
      dispatch({ type: 'repair', diagnostics: diagnosticsFromError(error) });
    }
  };
  const preview = async () => {
    if (!table || !state.receipt || previewDisabled) return;
    try {
      const value = await previewBuilder({
        project: projectId,
        explorerId: state.explorerId,
        authResourcePath,
        receiptId: state.receipt.receiptId,
        outputId: table.outputId,
        limit: previewLimit,
      }).unwrap();
      if (value.receiptId !== latestState.current.receipt?.receiptId) return;
      dispatch({ type: 'preview', value });
      setMessage(`Loaded ${value.rowCount.toLocaleString()} preview rows.`);
    } catch (error) {
      const apiError = error as ExplorerAuthoringApiError;
      if (isStaleSnapshot(apiError.code)) {
        preserveDraftOnRefetch.current = true;
        const refreshed = await refetchBuilder();
        if (refreshed.data) {
          dispatch({ type: 'catalogRefreshed', catalog: refreshed.data.catalog });
          setMessage('The receipt expired. Your edits are preserved; choose Recompile.');
        }
        return;
      }
      if (['PREVIEW_TOO_LARGE', 'RESPONSE_TOO_LARGE'].includes(apiError.code ?? '')) {
        const nextLimit = lowerPreviewLimit(previewLimit);
        setPreviewLimit(nextLimit);
        setMessage(`Preview was too large. The row limit is now ${nextLimit}; try again.`);
        return;
      }
      if (['PLAN_TOO_EXPENSIVE', 'EXPENSIVE_PLAN'].includes(apiError.code ?? '')) {
        setMessage('This plan is too expensive to preview. Remove outputs or columns, then recompile.');
      }
      dispatch({ type: 'repair', diagnostics: diagnosticsFromError(error) });
    }
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
      setMessage('Published every table atomically. The Viewer runtime is ready.');
    } catch (error) {
      const apiError = error as ExplorerAuthoringApiError;
      if (isStaleSnapshot(apiError.code)) {
        preserveDraftOnRefetch.current = true;
        const refreshed = await refetchBuilder();
        if (refreshed.data) {
          dispatch({ type: 'catalogRefreshed', catalog: refreshed.data.catalog });
          setMessage('The publish receipt expired. Local edits remain; choose Recompile.');
        }
        return;
      }
      dispatch({ type: 'repair', diagnostics: diagnosticsFromError(error) });
      setMessage('Publication failed. The previously active Viewer revision remains available.');
    }
  };

  if (explorers.isLoading || builder.isLoading) {
    return <main className="p-6" role="status">Loading the selected Explorer configuration…</main>;
  }
  if (explorers.error || builder.error || !builder.data) {
    return (
      <main className="p-6" role="alert">
        Loom’s V2 Builder state could not be loaded. This Builder has no V1 fallback.
      </main>
    );
  }

  const toolbar = (
    <BuilderToolbar
      explorers={explorers.data ?? []}
      selectedExplorerId={selectedExplorerId}
      projectId={projectId}
      onExplorerChange={(id) => {
        activeCompile.current?.abort();
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
    />
  );

  return (
    <main className="min-h-screen bg-slate-50 p-2 pb-10 text-slate-900 sm:p-3">
      {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
      <div className="mx-auto max-w-[1920px] space-y-3">
        {(message || state.diagnostics.length > 0 || state.reconciliation === 'pending' || state.reconciliation === 'stale') && (
          <section
            className={`rounded-lg border px-3 py-2 text-xs ${blockingDiagnostics ? 'border-red-300 bg-red-50 text-red-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
            role={blockingDiagnostics ? 'alert' : 'status'}
          >
            <div className="font-semibold">
              {blockingDiagnostics
                ? 'Builder needs attention'
                : state.reconciliation === 'pending'
                  ? 'Compiling workspace changes…'
                  : state.reconciliation === 'stale'
                    ? 'Catalog or receipt changed'
                    : 'Last operation'}
            </div>
            <p>{state.diagnostics[0]?.message ?? message}</p>
            {state.diagnostics[0]?.code ? (
              <p className="mt-1">Technical details · Code: {state.diagnostics[0].code}</p>
            ) : null}
            {(state.reconciliation === 'stale' || state.reconciliation === 'repair') && state.tables.length > 0 && !incomplete ? (
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
            <h2 className="text-lg font-semibold">Create the first table</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add a table, choose its row resource, and select at least one column.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-[#2f5aac] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#264a8c]"
              onClick={addTable}
            >
              New table
            </button>
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
                  table && dispatch({ type: 'setRoot', outputId: table.outputId, nodeId })
                }
                onChangeBase={(nodeId) =>
                  table && dispatch({ type: 'changeRoot', outputId: table.outputId, nodeId })
                }
                onAppendEdge={(edgeId) =>
                  table &&
                  dispatch({
                    type: 'appendEdge',
                    outputId: table.outputId,
                    edgeId,
                    occurrenceId: opaqueId('step'),
                  })
                }
                onTruncate={(occurrenceId) =>
                  table &&
                  dispatch({ type: 'truncateRoute', outputId: table.outputId, occurrenceId })
                }
              />
              <ColumnSelector
                catalog={state.catalog}
                table={table}
                emissions={emissions}
                occurrenceId={state.selectedOccurrenceId}
                disabled={!occurrence || state.reconciliation === 'pending' || suggestionsStatus.isLoading}
                onToggle={(candidateId, projectionMode, selected) =>
                  table &&
                  dispatch({
                    type: 'toggleCandidate',
                    outputId: table.outputId,
                    occurrenceId: state.selectedOccurrenceId,
                    candidateId,
                    projectionMode,
                    selected,
                  })
                }
                onProjection={(candidateId, projectionMode) =>
                  table &&
                  dispatch({
                    type: 'setProjection',
                    outputId: table.outputId,
                    occurrenceId: state.selectedOccurrenceId,
                    candidateId,
                    projectionMode,
                  })
                }
                onPresentation={(selection, value) =>
                  table &&
                  dispatch({
                    type: 'setPresentation',
                    outputId: table.outputId,
                    selection,
                    value,
                  })
                }
              />
            </div>
            <PreviewTable
              preview={state.preview}
              table={table}
              limit={previewLimit}
              onLimitChange={setPreviewLimit}
              onPresentation={(selection, value) =>
                table &&
                dispatch({
                  type: 'setPresentation',
                  outputId: table.outputId,
                  selection,
                  value,
                })
              }
            />
            <PresentationPanels features={capabilities.data?.features} />
          </>
        )}
      </div>
    </main>
  );
};

export default BuilderWorkspace;
