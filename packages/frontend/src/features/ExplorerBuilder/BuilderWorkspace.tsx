import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useApplyExplorerBuilderCommandsV2Mutation,
  useCreateExplorerAuthoringMutation,
  useDeleteExplorerAuthoringMutation,
  useGetExplorerAuthoringCapabilityV2Query,
  useGetExplorerAuthoringExplorersQuery,
  useGetExplorerBuilderStateV2Query,
  useGetExplorerCandidateSuggestionsV2Mutation,
  usePreviewExplorerAuthoringV2Mutation,
  usePublishExplorerAuthoringV2Mutation,
  useReconcileExplorerBuilderV2Mutation,
} from '@gen3/core';
import type {
  ExplorerAuthoringApiError,
  ExplorerAuthoringDiagnostic,
  ExplorerBuilderCatalog,
  ExplorerBuilderCommand,
  ExplorerBuilderCompileResult,
  ExplorerBuilderState,
} from '@gen3/core';
import { BuilderToolbar } from './components/BuilderToolbar';
import { GuidedGraphWorkspace } from './components/GuidedGraphWorkspace';
import { ColumnSelector } from './components/ColumnSelector';
import { PreviewTable } from './components/PreviewTable';
import {
  derivedOccurrences,
  intentFingerprint,
  routeNode,
  routeSubtreeOccurrenceIds,
  selectedTable,
  stateFromBuilder,
  workspaceFromState,
  type BuilderAuthoringState,
} from './authoring/model';
import { builderAuthoringReducer } from './authoring/reducer';
import {
  isPreviewResponseSizeError,
  previewRecoveryAction,
  type PreviewLimit,
} from './authoring/previewRecovery';
import { useDirtyBeforeUnload } from '../../hooks/explorerBuilder/useDirtyBeforeUnload';
import { usePortalHost } from '../../hooks/explorerBuilder/usePortalHost';

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
  draftVersion: 0,
  draftDigest: '',
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
const isDraftDesynchronized = (code: string | undefined) =>
  ['DRAFT_CONFLICT', 'INVALID_EXPLORER_COMMAND_RESULT'].includes(code ?? '');
const opaqueId = (prefix: 'output' | 'tab' | 'step') =>
  `${prefix}-${window.crypto.randomUUID()}`;

type PreviewRequest = {
  readonly outputId: string;
  readonly limit: PreviewLimit;
  readonly receiptRefreshes: number;
};

const builderDataKeyFor = (
  explorerId: string,
  value: {
    readonly catalog: ExplorerBuilderCatalog;
    readonly workspace: unknown;
    readonly draftVersion: number;
    readonly draftDigest: string;
  },
) =>
  `${explorerId}:${value.catalog.snapshotToken}:${value.draftVersion}:${value.draftDigest}:${JSON.stringify(value.workspace)}`;

const BuilderWorkspaceContent = ({
  organization,
  project,
  explorerId,
  onExplorerChange,
}: {
  readonly organization: string;
  readonly project: string;
  readonly explorerId?: string;
  readonly onExplorerChange?: (explorerId: string) => void;
}) => {
  const projectId = `${organization}/${project}`;
  const authResourcePath = `/programs/${organization}/projects/${project}`;
  const requestedExplorerId = explorerId || 'default';
  const [selectedExplorerId, setSelectedExplorerId] =
    useState(requestedExplorerId);
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
  const [deleteExplorer, deleteStatus] = useDeleteExplorerAuthoringMutation();
  const [applyBuilderCommands] = useApplyExplorerBuilderCommandsV2Mutation();
  const [reconcileBuilder, reconcileStatus] =
    useReconcileExplorerBuilderV2Mutation();
  const [getSuggestions, suggestionsStatus] =
    useGetExplorerCandidateSuggestionsV2Mutation();
  const [previewBuilder, previewStatus] =
    usePreviewExplorerAuthoringV2Mutation();
  const [publishBuilder, publishStatus] =
    usePublishExplorerAuthoringV2Mutation();
  const builderDataKey = builder.data
    ? builderDataKeyFor(selectedExplorerId, builder.data)
    : '';
  const builderDataRef = useRef(builder.data);
  builderDataRef.current = builder.data;
  const [localState, setLocalState] = useState<{
    readonly key: string;
    readonly value: BuilderAuthoringState;
  }>();
  const state =
    localState?.key === builderDataKey
      ? localState.value
      : builder.data
        ? stateFromBuilder(builder.data, {
            project: projectId,
            explorerId: selectedExplorerId,
          })
        : emptyBuilderState(projectId);
  const dispatch = useCallback(
    (action: Parameters<typeof builderAuthoringReducer>[1]) => {
      setLocalState((current) => {
        const base =
          current?.key === builderDataKey
            ? current.value
            : builderDataRef.current
              ? stateFromBuilder(builderDataRef.current, {
                  project: projectId,
                  explorerId: selectedExplorerId,
                })
              : emptyBuilderState(projectId);
        return {
          key: builderDataKey,
          value: builderAuthoringReducer(base, action),
        };
      });
    },
    [builderDataKey, projectId, selectedExplorerId],
  );
  const [message, setMessage] = useState<string>();
  const [pendingCommands, setPendingCommands] = useState(0);
  const [firstTableName, setFirstTableName] = useState('');
  const [previewLimit, setPreviewLimit] = useState<PreviewLimit>(25);
  const toolbarHost = usePortalHost('explorer-builder-toolbar-host');
  const [tableToolbarHost, setTableToolbarHost] = useState<HTMLElement | null>(
    null,
  );
  const compileGeneration = useRef(0);
  const activeCompile = useRef<{ abort: () => void } | undefined>(undefined);
  const commandQueue = useRef<Promise<void>>(Promise.resolve());
  const serverDraft = useRef({ version: 0, digest: '' });
  const suggestionRequestKey = useRef('');
  const latestState = useRef(state);
  latestState.current = state;

  const serverDraftKey = useRef('');
  if (builder.data && serverDraftKey.current !== builderDataKey) {
    serverDraft.current = {
      version: builder.data.draftVersion,
      digest: builder.data.draftDigest,
    };
    serverDraftKey.current = builderDataKey;
  }

  const selectExplorer = (nextExplorerId: string) => {
    compileGeneration.current += 1;
    activeCompile.current?.abort();
    setSelectedExplorerId(nextExplorerId);
    onExplorerChange?.(nextExplorerId);
  };

  const syncBuilderData = useCallback(
    (value: ExplorerBuilderState, mode: 'hydrate' | 'catalog') => {
      const nextKey = builderDataKeyFor(selectedExplorerId, value);
      serverDraft.current = {
        version: value.draftVersion,
        digest: value.draftDigest,
      };
      serverDraftKey.current = nextKey;
      setLocalState((current) => {
        const nextValue =
          mode === 'hydrate'
            ? stateFromBuilder(value, {
                project: projectId,
                explorerId: selectedExplorerId,
              })
            : builderAuthoringReducer(
                current?.key === builderDataKey
                  ? current.value
                  : latestState.current,
                { type: 'catalogRefreshed', catalog: value.catalog },
              );
        return { key: nextKey, value: nextValue };
      });
    },
    [builderDataKey, projectId, selectedExplorerId],
  );

  const incomplete = state.tables.some(
    (table) => !table.document.rootResourceType,
  );

  const applyCommands = useCallback(
    (commands: ReadonlyArray<ExplorerBuilderCommand>) => {
      compileGeneration.current += 1;
      activeCompile.current?.abort();
      setPendingCommands((value) => value + 1);
      const run = commandQueue.current.then(async () => {
        const current = latestState.current;
        const commandId = window.crypto.randomUUID();
        try {
          const value = await applyBuilderCommands({
            project: projectId,
            explorerId: current.explorerId,
            authResourcePath,
            commandId,
            snapshotToken: current.catalog.snapshotToken,
            expectedDraftVersion: serverDraft.current.version,
            expectedDraftDigest: serverDraft.current.digest || undefined,
            commands,
            requestId: `builder-command-${commandId}`,
          }).unwrap();
          serverDraft.current = {
            version: value.draftVersion,
            digest: value.draftDigest,
          };
          serverDraftKey.current = builderDataKey;
          dispatch({ type: 'commandsApplied', value });
          setMessage(undefined);
        } catch (error) {
          const apiError = error as ExplorerAuthoringApiError;
          if (
            isDraftDesynchronized(apiError.code) ||
            isStaleSnapshot(apiError.code)
          ) {
            const refreshed = await refetchBuilder();
            if (refreshed.data) {
              syncBuilderData(refreshed.data, 'hydrate');
              setMessage(undefined);
            } else if (apiError.code !== 'CLIENT_CANCELLED') {
              dispatch({
                type: 'repair',
                diagnostics: diagnosticsFromError(apiError),
              });
            }
            return;
          }
          if (apiError.code !== 'CLIENT_CANCELLED') {
            dispatch({
              type: 'repair',
              diagnostics: diagnosticsFromError(apiError),
            });
          }
        } finally {
          setPendingCommands((value) => Math.max(0, value - 1));
        }
      });
      commandQueue.current = run.catch(() => undefined);
      return run;
    },
    [
      applyBuilderCommands,
      authResourcePath,
      builderDataKey,
      dispatch,
      projectId,
      refetchBuilder,
      syncBuilderData,
    ],
  );

  useDirtyBeforeUnload(state.dirty);

  const table = selectedTable(state);
  const occurrences = useMemo(
    () => derivedOccurrences(table, state.catalog),
    [state.catalog, table],
  );
  const occurrence = occurrences.find(
    (candidate) => candidate.id === state.selectedOccurrenceId,
  );

  const ensureSuggestions = useCallback(() => {
    const current = latestState.current;
    const currentOccurrence = derivedOccurrences(
      selectedTable(current),
      current.catalog,
    ).find((candidate) => candidate.id === current.selectedOccurrenceId);
    if (!currentOccurrence || !current.catalog.snapshotToken) return;
    const key = `${current.explorerId}:${current.catalog.snapshotToken}:${currentOccurrence.id}`;
    if (suggestionRequestKey.current === key) return;
    suggestionRequestKey.current = key;
    if (
      (current.catalog.candidates ?? []).some(
        (candidate) => candidate.nodeId === currentOccurrence.nodeId,
      )
    )
      return;
    const request = getSuggestions({
      project: projectId,
      explorerId: current.explorerId,
      authResourcePath,
      snapshotToken: current.catalog.snapshotToken,
      nodeId: currentOccurrence.nodeId,
      requestId: `suggestions-${currentOccurrence.id}`,
    });
    void request
      .unwrap()
      .then((value) => {
        const latest = latestState.current;
        if (
          value.snapshotToken === latest.catalog.snapshotToken &&
          latest.selectedOccurrenceId === currentOccurrence.id
        ) {
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
  }, [authResourcePath, dispatch, getSuggestions, projectId]);
  const suggestionHostRef = useCallback(
    (host: HTMLSpanElement | null) => {
      if (host) ensureSuggestions();
    },
    [ensureSuggestions],
  );
  const suggestionIdentity = `${state.explorerId}:${state.catalog.snapshotToken}:${state.selectedOccurrenceId}`;
  const busy =
    pendingCommands > 0 ||
    reconcileStatus.isLoading ||
    previewStatus.isLoading ||
    publishStatus.isLoading ||
    createStatus.isLoading ||
    deleteStatus.isLoading;
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
    blockingDiagnostics ||
    state.tables.some((candidate) => candidate.document.columns.length === 0);

  const addTableNamed = (value: string) => {
    const title = value.trim();
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
  const addTable = () => {
    const title = window.prompt('Table name')?.trim();
    if (title) addTableNamed(title);
  };
  const duplicateTable = () => {
    if (!table) return;
    void applyCommands([
      {
        type: 'DUPLICATE_TABLE',
        sourceOutputId: table.outputId,
        title: `${table.title} copy`,
      },
    ]);
  };
  const createCustomExplorer = async (title: string, fromCurrent: boolean) => {
    try {
      const created = await createExplorer({
        project: projectId,
        authResourcePath,
        name: title,
        title,
        sourceExplorerId: fromCurrent ? state.explorerId : undefined,
      }).unwrap();
      selectExplorer(created.explorerId);
      void explorers.refetch();
      setMessage(undefined);
    } catch (error) {
      const apiError = error as ExplorerAuthoringApiError;
      const suffix = apiError.code ? ` (${apiError.code})` : '';
      setMessage(`Explorer creation failed: ${apiError.message}${suffix}`);
    }
  };
  const deleteCurrentExplorer = async () => {
    if (!capabilities.data?.features.deleteExplorer) return;
    const current = (explorers.data ?? []).find(
      (explorer) => explorer.explorerId === selectedExplorerId,
    );
    const fallback =
      (explorers.data ?? []).find(
        (explorer) =>
          explorer.explorerId !== selectedExplorerId &&
          explorer.explorerId === 'default',
      ) ??
      (explorers.data ?? []).find(
        (explorer) => explorer.explorerId !== selectedExplorerId,
      );
    if (!current || !fallback) return;
    if (
      !window.confirm(
        `Delete Explorer "${current.title}"? This permanently removes its configuration and cannot be undone.`,
      )
    )
      return;
    try {
      await deleteExplorer({
        project: projectId,
        explorerId: selectedExplorerId,
        authResourcePath,
        requestId: `delete-explorer-${selectedExplorerId}`,
      }).unwrap();
      compileGeneration.current += 1;
      activeCompile.current?.abort();
      selectExplorer(fallback.explorerId);
      await explorers.refetch();
      setMessage(undefined);
    } catch (error) {
      const apiError = error as ExplorerAuthoringApiError;
      const suffix = apiError.code ? ` (${apiError.code})` : '';
      setMessage(`Explorer deletion failed: ${apiError.message}${suffix}`);
    }
  };
  const reconcileCurrent = useCallback(async (): Promise<
    ExplorerBuilderCompileResult | undefined
  > => {
    const submitted = latestState.current;
    if (
      !submitted.catalog.snapshotToken ||
      submitted.tables.length === 0 ||
      submitted.tables.some((candidate) => !candidate.document.rootResourceType)
    )
      return undefined;
    const generation = ++compileGeneration.current;
    const submittedFingerprint = intentFingerprint(
      workspaceFromState(submitted),
    );
    let snapshotToken = submitted.catalog.snapshotToken;
    let draftVersion = submitted.draftVersion;
    let draftDigest = submitted.draftDigest;
    let attempt = 1;
    dispatch({ type: 'compiling' });
    for (;;) {
      const request = reconcileBuilder({
        project: projectId,
        explorerId: submitted.explorerId,
        authResourcePath,
        snapshotToken,
        draftVersion,
        draftDigest,
        requestId: `builder-${generation}-${attempt}`,
      });
      activeCompile.current = request;
      try {
        const value = await request.unwrap();
        if (generation !== compileGeneration.current) return undefined;
        const current = latestState.current;
        if (
          current.explorerId !== submitted.explorerId ||
          intentFingerprint(workspaceFromState(current)) !==
            submittedFingerprint
        )
          return undefined;
        dispatch({ type: 'compiled', value });
        return value.diagnostics.some(
          (diagnostic) => diagnostic.severity === 'error',
        )
          ? undefined
          : value;
      } catch (error) {
        const apiError = error as ExplorerAuthoringApiError;
        if (
          generation !== compileGeneration.current ||
          apiError.code === 'CLIENT_CANCELLED'
        )
          return undefined;
        if (isDraftDesynchronized(apiError.code)) {
          const refreshed = await refetchBuilder();
          if (refreshed.data) {
            syncBuilderData(refreshed.data, 'hydrate');
            setMessage(undefined);
          } else {
            dispatch({
              type: 'repair',
              diagnostics: diagnosticsFromError(apiError),
            });
          }
          return undefined;
        }
        if (isStaleSnapshot(apiError.code)) {
          const refreshed = await refetchBuilder();
          if (!refreshed.data) return undefined;
          syncBuilderData(refreshed.data, 'catalog');
          snapshotToken = refreshed.data.catalog.snapshotToken;
          draftVersion = refreshed.data.draftVersion;
          draftDigest = refreshed.data.draftDigest;
          attempt += 1;
          continue;
        }
        if (apiError.retryable && attempt < 3) {
          attempt += 1;
          await new Promise((resolve) => window.setTimeout(resolve, 250));
          continue;
        }
        dispatch({
          type: 'repair',
          diagnostics: diagnosticsFromError(apiError),
        });
        return undefined;
      } finally {
        if (generation === compileGeneration.current)
          activeCompile.current = undefined;
      }
    }
  }, [
    authResourcePath,
    dispatch,
    projectId,
    reconcileBuilder,
    refetchBuilder,
    syncBuilderData,
  ]);
  const executePreview = useCallback(
    async (request: PreviewRequest, receiptId: string) => {
      let activeRequest = request;
      let activeReceiptId = receiptId;
      const limit = request.limit;
      let transientRetries = 0;
      for (;;) {
        try {
          const value = await previewBuilder({
            project: projectId,
            explorerId: latestState.current.explorerId,
            authResourcePath,
            receiptId: activeReceiptId,
            outputId: activeRequest.outputId,
            limit,
          }).unwrap();
          if (value.receiptId !== activeReceiptId) return;
          dispatch({ type: 'preview', value });
          setMessage(undefined);
          return;
        } catch (error) {
          const apiError = error as ExplorerAuthoringApiError;
          if (apiError.code === 'CLIENT_CANCELLED') return;
          const recovery = previewRecoveryAction(apiError, {
            receiptRefreshes: activeRequest.receiptRefreshes,
            transientRetries,
            limit,
          });
          if (recovery === 'retry') {
            transientRetries += 1;
            continue;
          }
          if (recovery === 'recompile') {
            activeRequest = {
              ...activeRequest,
              limit,
              receiptRefreshes: activeRequest.receiptRefreshes + 1,
            };
            const receipt = await reconcileCurrent();
            if (!receipt) return;
            activeReceiptId = receipt.receiptId;
            setMessage(undefined);
            continue;
          }
          if (recovery === 'refresh-catalog') {
            activeRequest = {
              ...activeRequest,
              limit,
              receiptRefreshes: activeRequest.receiptRefreshes + 1,
            };
            const refreshed = await refetchBuilder();
            if (!refreshed.data) return;
            latestState.current = builderAuthoringReducer(latestState.current, {
              type: 'catalogRefreshed',
              catalog: refreshed.data.catalog,
            });
            syncBuilderData(refreshed.data, 'catalog');
            const receipt = await reconcileCurrent();
            if (!receipt) return;
            activeReceiptId = receipt.receiptId;
            setMessage(undefined);
            continue;
          }
          if (isPreviewResponseSizeError(apiError.code)) {
            setMessage(
              `Loom could not return ${limit} preview rows at the current table width. Choose fewer rows or hide some table columns.`,
            );
          } else if (
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
    [
      authResourcePath,
      dispatch,
      previewBuilder,
      projectId,
      reconcileCurrent,
      refetchBuilder,
      syncBuilderData,
    ],
  );

  const preview = async (limit: PreviewLimit = previewLimit) => {
    if (!table || previewDisabled) return;
    const request = {
      outputId: table.outputId,
      limit,
      receiptRefreshes: 0,
    };
    const receipt =
      state.receipt && state.reconciliation === 'resolved'
        ? state.receipt
        : await reconcileCurrent();
    if (receipt) await executePreview(request, receipt.receiptId);
  };
  const executePublish = useCallback(
    async (receiptId: string) => {
      let activeReceiptId = receiptId;
      let refreshes = 0;
      for (;;) {
        try {
          await publishBuilder({
            project: projectId,
            explorerId: latestState.current.explorerId,
            authResourcePath,
            receiptId: activeReceiptId,
          }).unwrap();
          dispatch({ type: 'published' });
          setMessage(undefined);
          return;
        } catch (error) {
          const apiError = error as ExplorerAuthoringApiError;
          if (isStaleSnapshot(apiError.code) && refreshes === 0) {
            refreshes += 1;
            const refreshed = await refetchBuilder();
            if (!refreshed.data) return;
            latestState.current = builderAuthoringReducer(latestState.current, {
              type: 'catalogRefreshed',
              catalog: refreshed.data.catalog,
            });
            syncBuilderData(refreshed.data, 'catalog');
            const receipt = await reconcileCurrent();
            if (!receipt) return;
            activeReceiptId = receipt.receiptId;
            continue;
          }
          const suffix = apiError.code ? ` (${apiError.code})` : '';
          setMessage(
            `Publication failed; the previously active Viewer revision remains available: ${apiError.message}${suffix}`,
          );
          return;
        }
      }
    },
    [
      authResourcePath,
      dispatch,
      projectId,
      publishBuilder,
      reconcileCurrent,
      refetchBuilder,
      syncBuilderData,
    ],
  );

  const publish = async () => {
    if (publishDisabled) return;
    const receipt =
      state.receipt && state.reconciliation === 'resolved'
        ? state.receipt
        : await reconcileCurrent();
    if (!receipt) return;
    const publishable = state.tables.every((candidate) =>
      receipt.outputs.some(
        (output) =>
          output.outputId === candidate.outputId && output.columns.length > 0,
      ),
    );
    if (!publishable) {
      setMessage(
        'Every table needs at least one output column before publishing.',
      );
      return;
    }
    await executePublish(receipt.receiptId);
  };

  if (explorers.isLoading || builder.isLoading) {
    return (
      <main className="p-6" role="status">
        Loading the selected Explorer configuration…
      </main>
    );
  }
  if (explorers.error || !builder.data) {
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
      onExplorerChange={selectExplorer}
      onCreateExplorer={(title, fromCurrent) =>
        void createCustomExplorer(title, fromCurrent)
      }
      deleteSupported={capabilities.data?.features.deleteExplorer ?? false}
      deleteDisabled={
        !(explorers.data ?? []).some(
          (explorer) => explorer.explorerId !== selectedExplorerId,
        )
      }
      onDeleteExplorer={() => void deleteCurrentExplorer()}
      tables={state.tables}
      selectedOutputId={state.selectedOutputId}
      onSelectTable={(outputId) => dispatch({ type: 'selectTable', outputId })}
      onRenameTable={(outputId, title) => {
        const target = state.tables.find(
          (candidate) => candidate.outputId === outputId,
        );
        if (!target?.document.rootResourceType) {
          dispatch({ type: 'renameTable', outputId, title });
          return;
        }
        void applyCommands([{ type: 'RENAME_TABLE', outputId, title }]);
      }}
      onNewTable={addTable}
      onDuplicateTable={duplicateTable}
      onDeleteTable={() =>
        table &&
        window.confirm(`Delete ${table.title}?`) &&
        (table.document.rootResourceType
          ? void applyCommands([
              { type: 'DELETE_TABLE', outputId: table.outputId },
            ])
          : dispatch({ type: 'removeTable', outputId: table.outputId }))
      }
      onReorderTable={(outputId, before) => {
        const moving = state.tables.find(
          (candidate) => candidate.outputId === outputId,
        );
        if (!moving?.document.rootResourceType || incomplete) {
          dispatch({ type: 'reorderTable', outputId, before });
          return;
        }
        const outputIds = state.tables
          .filter((candidate) => candidate.outputId !== outputId)
          .map((candidate) => candidate.outputId);
        const index = before ? outputIds.indexOf(before) : outputIds.length;
        outputIds.splice(index < 0 ? outputIds.length : index, 0, outputId);
        void applyCommands([{ type: 'REORDER_TABLES', outputIds }]);
      }}
      onPreview={() => void preview()}
      onPublish={() => void publish()}
      previewDisabled={previewDisabled}
      publishDisabled={publishDisabled}
      busy={busy}
      columnCreationSupported
      tableToolbarHost={tableToolbarHost}
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
          <section className="rounded-xl border border-blue-200 bg-white px-6 py-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Create your first table
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Name the table, choose its starting resource in the dataset graph,
              then select the columns you want to publish.
            </p>
            <form
              className="mx-auto mt-6 flex max-w-lg flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                if (!firstTableName.trim()) return;
                addTableNamed(firstTableName);
                setFirstTableName('');
              }}
            >
              <label className="sr-only" htmlFor="first-table-name">
                Table name
              </label>
              <input
                id="first-table-name"
                value={firstTableName}
                onChange={(event) =>
                  setFirstTableName(event.currentTarget.value)
                }
                placeholder="Table name, e.g. Patients"
                autoFocus
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!firstTableName.trim()}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create table
              </button>
            </form>
          </section>
        ) : (
          <>
            <span key={suggestionIdentity} ref={suggestionHostRef} hidden />
            <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(28rem,0.95fr)]">
              <GuidedGraphWorkspace
                catalog={state.catalog}
                table={table}
                selectedOccurrenceId={state.selectedOccurrenceId}
                disabled={
                  state.reconciliation === 'pending' &&
                  Boolean(table?.document.rootResourceType)
                }
                onSelectOccurrence={(occurrenceId) =>
                  dispatch({ type: 'selectOccurrence', occurrenceId })
                }
                onSetBase={(nodeId) =>
                  table &&
                  void applyCommands([
                    {
                      type: 'CREATE_TABLE',
                      title: table.title,
                      rootNodeId: nodeId,
                    },
                  ])
                }
                onChangeBase={(nodeId) =>
                  table &&
                  window.confirm(
                    `Start a new query from ${state.catalog.nodes.find((node) => node.nodeId === nodeId)?.resourceType ?? 'this resource'}? This replaces the current ${occurrences.length}-node query and removes ${table.document.columns.length} configured columns from this local draft.`,
                  ) &&
                  void applyCommands([
                    {
                      type: 'SET_TABLE_ROOT',
                      outputId: table.outputId,
                      rootNodeId: nodeId,
                    },
                  ])
                }
                onAppendEdge={(parentOccurrenceId, edgeId) => {
                  if (!table) return;
                  const edge = state.catalog.edges.find(
                    (candidate) => candidate.edgeId === edgeId,
                  );
                  if (!edge) return;
                  void applyCommands([
                    {
                      type: 'ADD_ROUTE',
                      outputId: table.outputId,
                      parentOccurrenceId,
                      edgeId,
                    },
                  ]);
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
                  void applyCommands([
                    {
                      type: 'REMOVE_ROUTE',
                      outputId: table.outputId,
                      occurrenceId,
                    },
                  ]);
                }}
                onTableToolbarHostChange={setTableToolbarHost}
              />
              <ColumnSelector
                catalog={state.catalog}
                table={table}
                occurrenceId={state.selectedOccurrenceId}
                disabled={!occurrence}
                loadingCandidates={suggestionsStatus.isLoading}
                onAdd={(candidate, displayName, initialPresentation) =>
                  table &&
                  void applyCommands([
                    {
                      type: 'ADD_COLUMN',
                      outputId: table.outputId,
                      occurrenceId: state.selectedOccurrenceId,
                      candidateId: candidate.candidateId,
                      projectionMode: candidate.defaultProjectionMode,
                      initialPresentation,
                      title: displayName,
                    },
                  ])
                }
                onAddAll={(candidates) => {
                  if (!table) return;
                  void applyCommands(
                    candidates.map((candidate) => ({
                      type: 'ADD_COLUMN' as const,
                      outputId: table.outputId,
                      occurrenceId: state.selectedOccurrenceId,
                      candidateId: candidate.candidateId,
                      projectionMode: candidate.defaultProjectionMode,
                      initialPresentation: 'TABLE',
                      title: candidate.label,
                    })),
                  );
                }}
                onChange={(column) =>
                  table &&
                  void applyCommands([
                    {
                      type: 'UPDATE_COLUMN',
                      outputId: table.outputId,
                      column: column.column,
                      columnValue: column,
                    },
                  ])
                }
                onRemove={(column) =>
                  table &&
                  void applyCommands([
                    {
                      type: 'REMOVE_COLUMN',
                      outputId: table.outputId,
                      column,
                    },
                  ])
                }
              />
            </div>
            <PreviewTable
              preview={state.preview}
              table={table}
              limit={previewLimit}
              onLimitChange={(limit) => {
                setPreviewLimit(limit);
                preview(limit);
              }}
              onColumnChange={(column) =>
                table &&
                void applyCommands([
                  {
                    type: 'UPDATE_COLUMN',
                    outputId: table.outputId,
                    column: column.column,
                    columnValue: column,
                  },
                ])
              }
              onColumnsChange={(columns) =>
                table &&
                void applyCommands(
                  columns.map((column) => ({
                    type: 'UPDATE_COLUMN' as const,
                    outputId: table.outputId,
                    column: column.column,
                    columnValue: column,
                  })),
                )
              }
            />
          </>
        )}
      </div>
    </main>
  );
};

const BuilderWorkspace = (
  props: React.ComponentProps<typeof BuilderWorkspaceContent>,
) => <BuilderWorkspaceContent key={props.explorerId || 'default'} {...props} />;

export default BuilderWorkspace;
