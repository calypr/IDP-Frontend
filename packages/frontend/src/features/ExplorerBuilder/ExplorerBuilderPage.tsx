import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BuilderApiError,
  ExplorerAuthoringDocument,
  ProjectRecipeRevision,
  RecipeAuthoringDocument,
} from '@gen3/core';
import {
  useGetAuthzMappingsQuery,
  userHasMethodForServiceOnResource,
} from '@gen3/core';
import {
  useActivateExplorerRevisionMutation,
  useCreateExplorerMutation,
  useGetExplorerQuery,
  useGetExplorersQuery,
  useGetProjectRecipeQuery,
  useGetProjectRecipeRevisionsQuery,
  usePreviewProjectRecipeMutation,
  usePublishExplorerMutation,
  usePublishProjectRecipeMutation,
  useSaveExplorerDraftMutation,
  useSaveProjectRecipeDraftMutation,
  useValidateExplorerMutation,
  useValidateProjectRecipeMutation,
} from '@gen3/core';
import {
  ExplorerBuilderSessionProvider,
  buildPreviewCacheKey,
  schedulePreview,
  useExplorerBuilderSession,
} from './session';
import { GuidedBuilder } from './guided/GuidedBuilder';

const diagnosticsFromError = (error: unknown) => {
  const candidate = error as
    | (Partial<BuilderApiError> & {
        readonly diagnostics?: BuilderApiError['diagnostics'];
      })
    | undefined;
  return candidate?.diagnostics?.length
    ? candidate.diagnostics
    : [
        {
          severity: 'error' as const,
          code: 'BUILDER_ERROR',
          message: 'The request failed.',
        },
      ];
};

const hasDiagnosticErrors = (
  diagnostics: ReadonlyArray<{ readonly severity: string }>,
) => diagnostics.some((diagnostic) => diagnostic.severity === 'error');

class LifecycleDiagnosticsError extends Error {
  readonly diagnostics: ReturnType<typeof diagnosticsFromError>;

  constructor(
    message: string,
    diagnostics: ReturnType<typeof diagnosticsFromError>,
  ) {
    super(message);
    this.name = 'LifecycleDiagnosticsError';
    this.diagnostics = diagnostics;
  }
}

/**
 * Wait for the exact revision returned by publish. The API may take longer
 * than a request timeout to materialize Loom outputs, so a short fixed retry
 * loop would incorrectly turn a successful publication into a failure.
 */
export const waitForReadyRecipeRevision = async (
  initial: ProjectRecipeRevision,
  refresh: () => Promise<ReadonlyArray<ProjectRecipeRevision>>,
  options: { readonly intervalMs?: number; readonly maxWaitMs?: number } = {},
): Promise<ProjectRecipeRevision> => {
  const intervalMs = options.intervalMs ?? 1000;
  const maxWaitMs = options.maxWaitMs ?? 120_000;
  const startedAt = Date.now();
  let revision = initial;

  for (;;) {
    if (revision.status === 'READY') return revision;
    if (revision.status === 'FAILED') {
      throw new LifecycleDiagnosticsError(
        'Recipe publication failed.',
        revision.diagnostics,
      );
    }
    if (Date.now() - startedAt >= maxWaitMs) {
      throw new LifecycleDiagnosticsError(
        'Recipe publication is still in progress. Retry to continue polling.',
        [
          {
            severity: 'error',
            code: 'RECIPE_PUBLICATION_TIMEOUT',
            message:
              'The recipe is still materializing. No changes were lost; retry to continue.',
            retryable: true,
          },
        ],
      );
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const revisions = await refresh();
    revision =
      revisions.find((candidate) => candidate.id === initial.id) ?? revision;
  }
};

const BuilderWorkspace = ({
  requestedCanUpdate,
}: {
  readonly requestedCanUpdate: boolean;
}) => {
  const { state, dispatch } = useExplorerBuilderSession();
  const project = state.project;
  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();
  const projectResource = `/programs/${project.organization}/projects/${project.project}`;
  const canUpdate =
    requestedCanUpdate &&
    [
      projectResource,
      `/programs/${project.organization}/projects`,
      `/programs/${project.organization}`,
      '/programs',
      '/',
      '*',
    ].some((path) =>
      userHasMethodForServiceOnResource('update', '*', path, authzMapping),
    );
  const { data: recipe } = useGetProjectRecipeQuery(project);
  const recipeRevisionsQuery = useGetProjectRecipeRevisionsQuery(project, {
    pollingInterval: 5000,
  });
  const recipeRevisions = useMemo(
    () => recipeRevisionsQuery.data ?? [],
    [recipeRevisionsQuery.data],
  );
  const explorersQuery = useGetExplorersQuery(project);
  const explorers = useMemo(
    () => explorersQuery.data ?? [],
    [explorersQuery.data],
  );
  const [saveRecipe] = useSaveProjectRecipeDraftMutation();
  const [validateRecipe] = useValidateProjectRecipeMutation();
  const [previewRecipe] = usePreviewProjectRecipeMutation();
  const [publishRecipe] = usePublishProjectRecipeMutation();
  const [createExplorer] = useCreateExplorerMutation();
  const [saveExplorer] = useSaveExplorerDraftMutation();
  const [validateExplorer] = useValidateExplorerMutation();
  const [publishExplorer] = usePublishExplorerMutation();
  const [activateExplorer] = useActivateExplorerRevisionMutation();
  const [output, setOutput] = useState('');
  const [limit] = useState<10 | 25 | 50 | 100>(25);
  const [configId, setConfigId] = useState('');
  const [shareUrl, setShareUrl] = useState<string>();
  const [lifecycleStatus, setLifecycleStatus] = useState<string>();
  const previewAbort = useRef<{ abort?: () => void } | undefined>(undefined);
  const guidedPreviewCancel = useRef<(() => void) | undefined>(undefined);
  const explorerQueryConfigId = configId || explorers[0]?.configId || '';
  const selectedExplorer = useGetExplorerQuery(
    { ...project, configId: explorerQueryConfigId },
    { skip: !explorerQueryConfigId },
  );
  const readyRevisions = recipeRevisions.filter(
    (revision) => revision.status === 'READY',
  );
  const latestReadyRevision = readyRevisions.reduce<
    ProjectRecipeRevision | undefined
  >(
    (latest, candidate) =>
      !latest || candidate.revisionNumber > latest.revisionNumber
        ? candidate
        : latest,
    undefined,
  );
  const selectedRecipeRevisionId =
    state.selectedRecipeRevisionId ?? latestReadyRevision?.id;

  useEffect(() => {
    if (!recipe || state.recipeDirty) return;
    dispatch({
      type: 'loadRecipe',
      draft: recipe.document,
      version: recipe.draftVersion,
    });
  }, [dispatch, recipe, state.recipeDirty]);

  useEffect(() => {
    const explorer = selectedExplorer.data;
    if (!explorer || state.explorerDirty) return;
    dispatch({
      type: 'loadExplorer',
      draft: explorer.draftContent,
      version: explorer.draftVersion,
    });
  }, [dispatch, selectedExplorer.data, state.explorerDirty]);

  useEffect(() => {
    if (!configId && explorers[0]) setConfigId(explorers[0].configId);
  }, [configId, explorers]);

  const editRecipeDocument = (draft: RecipeAuthoringDocument) => {
    dispatch({ type: 'editRecipe', draft });
  };

  const editExplorerDocument = (draft: ExplorerAuthoringDocument) => {
    dispatch({ type: 'editExplorer', draft });
  };

  const runPreview = async (
    requestedOutput = output,
    recipeForPreview = state.recipeDraft,
  ) => {
    if (!requestedOutput) return;
    if (requestedOutput !== output) setOutput(requestedOutput);
    const key = await buildPreviewCacheKey(
      project,
      recipeForPreview,
      requestedOutput,
      limit,
    );
    if (
      state.previewByOutput[requestedOutput]?.key === key &&
      (state.previewByOutput[requestedOutput]?.status === 'ready' ||
        state.previewByOutput[requestedOutput]?.status === 'loading')
    )
      return;
    previewAbort.current?.abort?.();
    dispatch({ type: 'previewLoading', output: requestedOutput, key });
    const request = previewRecipe({
      ...project,
      recipe: recipeForPreview,
      output: requestedOutput,
      limit,
    });
    previewAbort.current = request;
    try {
      dispatch({
        type: 'previewReady',
        output: requestedOutput,
        key,
        data: await request.unwrap(),
      });
    } catch (error) {
      dispatch({
        type: 'previewError',
        output: requestedOutput,
        key,
        diagnostics: diagnosticsFromError(error),
      });
    }
  };

  const scheduleGuidedPreview = (
    name: string,
    draft: RecipeAuthoringDocument,
  ) => {
    guidedPreviewCancel.current?.();
    guidedPreviewCancel.current = schedulePreview(
      () => void runPreview(name, draft),
    );
  };

  const reportLifecycleError = (
    error: unknown,
    scope: 'recipe' | 'explorer' | 'activation',
    message: string,
  ) => {
    const diagnostics = diagnosticsFromError(error);
    const candidate = error as BuilderApiError | undefined;
    if (
      (scope === 'recipe' || scope === 'explorer') &&
      candidate?.status === 409
    ) {
      dispatch({
        type: 'draftConflict',
        conflict: {
          scope,
          currentVersion: candidate.currentVersion,
          currentDigest: candidate.currentDigest,
          updatedAt: candidate.updatedAt,
          diagnostics,
        },
      });
    }
    dispatch({
      type: scope === 'recipe' ? 'recipeDiagnostics' : 'explorerDiagnostics',
      diagnostics,
    });
    setLifecycleStatus(message);
  };

  const createDefaultExplorerIfNeeded = async () => {
    if (configId) {
      return { configId, created: undefined };
    }
    if (
      explorersQuery.isLoading ||
      explorersQuery.isFetching ||
      explorersQuery.isError
    ) {
      throw new LifecycleDiagnosticsError(
        'Explorer configurations are still loading.',
        [
          {
            severity: 'warning',
            code: 'EXPLORER_LIST_LOADING',
            message: 'Retry once the Explorer list has finished loading.',
            retryable: true,
          },
        ],
      );
    }
    if (explorers.length > 0) {
      const first = explorers[0];
      setConfigId(first.configId);
      return { configId: first.configId, created: undefined };
    }
    const created = await createExplorer({
      ...project,
      configId: 'default',
      title: 'Default Explorer',
    }).unwrap();
    setConfigId(created.configId);
    return { configId: created.configId, created };
  };

  const saveDraft = async () => {
    if (!canUpdate) return;
    setLifecycleStatus('Saving draft…');
    let scope: 'recipe' | 'explorer' = 'recipe';
    try {
      if (state.recipeDirty) {
        const saved = await saveRecipe({
          ...project,
          draft: state.recipeDraft,
          expectedDraftVersion: state.recipeDraftVersion,
        }).unwrap();
        dispatch({
          type: 'recipeSaved',
          draft: saved.document,
          version: saved.draftVersion,
        });
      }

      scope = 'explorer';
      const target = await createDefaultExplorerIfNeeded();
      // A newly-created Explorer already has a server-owned draft. Adopt it;
      // only send a draft PUT when the steward actually edited the document.
      if (target.created && !state.explorerDirty) {
        dispatch({
          type: 'loadExplorer',
          draft: target.created.draftContent,
          version: target.created.draftVersion,
        });
      } else if (state.explorerDirty) {
        const saved = await saveExplorer({
          ...project,
          configId: target.configId,
          draft: state.explorerDraft,
          expectedDraftVersion:
            target.created?.draftVersion ?? state.explorerDraftVersion,
        }).unwrap();
        dispatch({
          type: 'explorerSaved',
          draft: saved.draftContent,
          version: saved.draftVersion,
        });
      }
      setLifecycleStatus('Draft saved.');
    } catch (error) {
      reportLifecycleError(
        error,
        scope,
        'Draft could not be saved. Resolve the diagnostics and retry.',
      );
    }
  };

  const makeLive = async () => {
    if (!canUpdate) return;
    setLifecycleStatus('Saving draft…');
    let scope: 'recipe' | 'explorer' | 'activation' = 'recipe';
    try {
      let recipeDraft = recipe;
      if (state.recipeDirty || !recipeDraft) {
        recipeDraft = await saveRecipe({
          ...project,
          draft: state.recipeDraft,
          expectedDraftVersion: state.recipeDraftVersion,
        }).unwrap();
        dispatch({
          type: 'recipeSaved',
          draft: recipeDraft.document,
          version: recipeDraft.draftVersion,
        });
      }

      let revision = recipeRevisions.find(
        (candidate) =>
          candidate.id === selectedRecipeRevisionId &&
          candidate.status === 'READY',
      );
      if (!revision || state.recipeDirty) {
        scope = 'recipe';
        const validation = await validateRecipe({
          ...project,
          recipe: recipeDraft.document,
        }).unwrap();
        dispatch({
          type: 'recipeDiagnostics',
          diagnostics: validation.diagnostics,
        });
        if (hasDiagnosticErrors(validation.diagnostics)) {
          throw new LifecycleDiagnosticsError(
            'Recipe validation failed.',
            validation.diagnostics,
          );
        }
        setLifecycleStatus('Publishing recipe…');
        revision = await publishRecipe({
          ...project,
          expectedDraftVersion: recipeDraft.draftVersion,
          expectedAuthoringDigest: recipeDraft.authoringDigest,
        }).unwrap();
        revision = await waitForReadyRecipeRevision(
          revision,
          async () => (await recipeRevisionsQuery.refetch()).data ?? [],
        );
        dispatch({ type: 'selectRecipeRevision', revisionId: revision.id });
      }

      scope = 'explorer';
      const target = await createDefaultExplorerIfNeeded();
      let explorerDraft = state.explorerDraft;
      let explorerDraftVersion = state.explorerDraftVersion;
      let currentExplorer =
        selectedExplorer.data ??
        explorers.find((candidate) => candidate.configId === target.configId);
      if (
        !state.explorerDirty &&
        !target.created &&
        target.configId === explorerQueryConfigId
      ) {
        const refreshed = await selectedExplorer.refetch();
        currentExplorer = refreshed.data ?? currentExplorer;
      }
      if (target.created) {
        explorerDraft = target.created.draftContent;
        explorerDraftVersion = target.created.draftVersion;
        if (!state.explorerDirty) {
          dispatch({
            type: 'loadExplorer',
            draft: explorerDraft,
            version: explorerDraftVersion,
          });
        }
      } else if (!state.explorerDirty && currentExplorer) {
        // A clean session can safely adopt a newer remote draft, preventing a
        // stale local document from being republished after a reload.
        explorerDraft = currentExplorer.draftContent;
        explorerDraftVersion = currentExplorer.draftVersion;
      }
      if (state.explorerDirty) {
        setLifecycleStatus('Saving Explorer draft…');
        const savedExplorer = await saveExplorer({
          ...project,
          configId: target.configId,
          draft: explorerDraft,
          expectedDraftVersion: explorerDraftVersion,
        }).unwrap();
        explorerDraft = savedExplorer.draftContent;
        explorerDraftVersion = savedExplorer.draftVersion;
        dispatch({
          type: 'explorerSaved',
          draft: explorerDraft,
          version: explorerDraftVersion,
        });
      }

      const explorerValidation = await validateExplorer({
        ...project,
        configId: target.configId,
        draft: explorerDraft,
        recipeRevisionId: revision.id,
      }).unwrap();
      dispatch({
        type: 'explorerDiagnostics',
        diagnostics: explorerValidation.diagnostics,
      });
      if (hasDiagnosticErrors(explorerValidation.diagnostics)) {
        throw new LifecycleDiagnosticsError(
          'Explorer validation failed.',
          explorerValidation.diagnostics,
        );
      }

      setLifecycleStatus('Publishing Explorer…');
      const published = await publishExplorer({
        ...project,
        configId: target.configId,
        expectedDraftVersion: explorerDraftVersion,
        recipeRevisionId: revision.id,
      }).unwrap();

      // Refresh the CAS token immediately before activation. The Explorer may
      // have been created or loaded while another release was being activated.
      let expectedActiveReleaseId =
        target.created?.activeReleaseId ??
        explorers.find((candidate) => candidate.configId === target.configId)
          ?.activeReleaseId ??
        selectedExplorer.data?.activeReleaseId ??
        null;
      if (!target.created && target.configId === explorerQueryConfigId) {
        const refreshed = await selectedExplorer.refetch();
        expectedActiveReleaseId = refreshed.data?.activeReleaseId ?? null;
      }
      setLifecycleStatus('Making live…');
      scope = 'activation';
      const release = await activateExplorer({
        ...project,
        configId: target.configId,
        revisionId: published.id,
        expectedActiveReleaseId,
      }).unwrap();
      setShareUrl(release.shareUrl);
      setLifecycleStatus('Live Explorer is ready.');
    } catch (error) {
      reportLifecycleError(
        error,
        scope,
        'Could not make this Explorer live. Fix the diagnostics and retry.',
      );
    }
  };

  const preview = output ? state.previewByOutput[output] : undefined;
  return (
    <main className="w-full p-3">
      {state.conflict && (
        <section
          role="alert"
          aria-label="Draft conflict"
          className="mb-5 rounded border border-red-300 bg-red-50 p-3"
        >
          <strong>Remote changes detected.</strong> Reload the remote draft or
          copy your local JSON before continuing.
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (state.conflict?.scope === 'recipe' && recipe) {
                  dispatch({
                    type: 'loadRecipe',
                    draft: recipe.document,
                    version: recipe.draftVersion,
                  });
                }
                if (
                  state.conflict?.scope === 'explorer' &&
                  selectedExplorer.data
                ) {
                  dispatch({
                    type: 'loadExplorer',
                    draft: selectedExplorer.data.draftContent,
                    version: selectedExplorer.data.draftVersion,
                  });
                }
                dispatch({ type: 'clearDraftConflict' });
              }}
            >
              Reload remote
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'clearDraftConflict' })}
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                const text = JSON.stringify(
                  state.conflict?.scope === 'recipe'
                    ? state.recipeDraft
                    : state.explorerDraft,
                  null,
                  2,
                );
                void navigator.clipboard?.writeText(text);
              }}
            >
              Copy local JSON
            </button>
          </div>
        </section>
      )}
      <GuidedBuilder
        disabled={!canUpdate}
        recipeSource={recipe?.source}
        explorer={state.explorerDraft}
        onExplorerChange={editExplorerDocument}
        onPreview={scheduleGuidedPreview}
        onRender={(name, draft) => void runPreview(name, draft)}
        preview={preview?.data}
        previewStatus={preview?.status}
        previewError={preview?.diagnostics?.map((diagnostic) => diagnostic.message).join(' ')}
        previewOutput={output}
        onRetryPreview={output ? () => void runPreview() : undefined}
        onSaveDraft={() => void saveDraft()}
        onMakeLive={() => void makeLive()}
        onRecipeChange={editRecipeDocument}
        organization={project.organization}
        project={project.project}
        recipe={state.recipeDraft}
      />
      {preview?.status === 'loading' && <p className="mt-4">Loading sample…</p>}
      {lifecycleStatus && (
        <p
          role="status"
          className="mt-2 rounded bg-blue-50 p-3 text-sm text-blue-900"
        >
          {lifecycleStatus}
        </p>
      )}
      {shareUrl && (
        <p role="status" className="mt-2 rounded bg-green-50 p-3 text-sm text-green-900">
          Immutable share URL: <a className="underline" href={shareUrl}>{shareUrl}</a>
        </p>
      )}
    </main>
  );
};

export const ExplorerBuilderPage = ({
  organization,
  project,
  canUpdate = process.env.NEXT_PUBLIC_EXPLORER_BUILDER_READ_ONLY !== 'true',
}: {
  readonly organization: string;
  readonly project: string;
  readonly canUpdate?: boolean;
}) => (
  <ExplorerBuilderSessionProvider project={{ organization, project }}>
    <BuilderWorkspace requestedCanUpdate={canUpdate} />
  </ExplorerBuilderSessionProvider>
);
