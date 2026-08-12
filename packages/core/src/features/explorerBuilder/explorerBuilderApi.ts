import type {
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query';
import { GEN3_GECKO_API } from '../../constants';
import { gen3Api } from '../gen3';
import type {
  BuilderApiError,
  BuilderDiagnostic,
  BuilderProject,
  ExplorerAuthoringDocument,
  ExplorerBuilderState,
  ExplorerConfigRevision,
  ExplorerRelease,
  ProjectRecipeDraft,
  ProjectRecipeRevision,
  RecipeAuthoringDocument,
  RecipeDraftPreview,
  RecipeDraftValidation,
  ResolvedExplorerRelease,
} from './types';
import type { LoomColumn } from '../loom';
import type { JSONValue } from '../../types';

type ProjectArgs = BuilderProject;
type ConfigArgs = ProjectArgs & { readonly configId: string };

const segment = (value: string) => encodeURIComponent(value);
const projectPath = ({ organization, project }: ProjectArgs) =>
  `${GEN3_GECKO_API}/builder/projects/${segment(organization)}/${segment(project)}`;
const explorerPath = (args: ConfigArgs) =>
  `${projectPath(args)}/explorers/${segment(args.configId)}`;

export const explorerRevisionCollectionPath = (args: ConfigArgs) =>
  `${explorerPath(args)}/revisions`;

export const explorerRevisionPath = (
  args: ConfigArgs & { readonly revisionId: string },
) => `${explorerRevisionCollectionPath(args)}/${segment(args.revisionId)}`;

export const activateExplorerRevisionPath = (
  args: ConfigArgs & { readonly revisionId: string },
) => `${explorerRevisionPath(args)}/activate`;

export const buildExplorerDraftBody = (draft: ExplorerAuthoringDocument) => ({
  config: draft,
});

export const buildExplorerValidationBody = (
  draft: ExplorerAuthoringDocument,
  recipeRevisionId: string,
) => ({
  ...buildExplorerDraftBody(draft),
  recipeRevisionId,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const normalizeBuilderApiError = (
  response: FetchBaseQueryError,
  meta?: FetchBaseQueryMeta,
): BuilderApiError => {
  const data = isRecord(response.data) ? response.data : {};
  const rawDiagnostics = Array.isArray(data.diagnostics)
    ? data.diagnostics
    : [];
  const requestId =
    (typeof data.requestId === 'string' ? data.requestId : undefined) ??
    meta?.response?.headers.get('x-request-id') ??
    undefined;
  const diagnostics: BuilderDiagnostic[] = rawDiagnostics
    .filter(isRecord)
    .map((diagnostic) => ({
      severity: diagnostic.severity === 'warning' ? 'warning' : 'error',
      code:
        typeof diagnostic.code === 'string' ? diagnostic.code : 'BUILDER_ERROR',
      configPath:
        typeof diagnostic.configPath === 'string'
          ? diagnostic.configPath
          : typeof diagnostic.fieldPath === 'string'
            ? diagnostic.fieldPath
            : undefined,
      message:
        typeof diagnostic.message === 'string'
          ? diagnostic.message
          : 'The builder request failed.',
      retryable:
        typeof diagnostic.retryable === 'boolean'
          ? diagnostic.retryable
          : undefined,
      requestId:
        typeof diagnostic.requestId === 'string'
          ? diagnostic.requestId
          : requestId,
      details: isRecord(diagnostic.details) ? diagnostic.details : undefined,
    }));
  const numericStatus =
    typeof response.status === 'number' ? response.status : undefined;
  return {
    status: response.status,
    requestId,
    retryable:
      typeof data.retryable === 'boolean'
        ? data.retryable
        : numericStatus === 408 ||
          numericStatus === 425 ||
          numericStatus === 429 ||
          (numericStatus !== undefined && numericStatus >= 500),
    diagnostics:
      diagnostics.length > 0
        ? diagnostics
        : [
            {
              severity: 'error',
              code: typeof data.code === 'string' ? data.code : 'BUILDER_ERROR',
              message:
                typeof data.message === 'string'
                  ? data.message
                  : typeof data.error === 'string'
                    ? data.error
                    : 'The builder request failed.',
              requestId,
            },
          ],
    currentVersion:
      typeof data.currentVersion === 'number' ? data.currentVersion : undefined,
    currentDigest:
      typeof data.currentDigest === 'string' ? data.currentDigest : undefined,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
  };
};

const errorResponse = (
  response: FetchBaseQueryError,
  meta: FetchBaseQueryMeta | undefined,
) => normalizeBuilderApiError(response, meta);

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  isRecord(value) ? value : {};

const normalizeColumn = (value: unknown): LoomColumn => {
  if (typeof value === 'string') {
    return {
      name: value,
      clickhouseType: 'String',
      logicalType: 'string',
      nullable: false,
      repeated: false,
      filterable: true,
      sortable: true,
      aggregatable: false,
    };
  }
  const column = asRecord(value);
  const logicalType =
    typeof column.logicalType === 'string'
      ? column.logicalType
      : typeof column.type === 'string'
        ? column.type
        : 'string';
  return {
    name: typeof column.name === 'string' ? column.name : '',
    clickhouseType:
      typeof column.clickhouseType === 'string'
        ? column.clickhouseType
        : logicalType,
    logicalType,
    nullable: column.nullable === true,
    repeated: column.repeated === true,
    filterable: column.filterable !== false,
    sortable: column.sortable !== false,
    aggregatable: column.aggregatable === true,
  };
};

const normalizeColumns = (value: unknown): LoomColumn[] =>
  Array.isArray(value) ? value.map(normalizeColumn) : [];

export const normalizeProjectRecipeDraft = (
  value: unknown,
): ProjectRecipeDraft => {
  const draft = asRecord(value);
  const draftVersion =
    typeof draft.draftVersion === 'number' ? draft.draftVersion : 0;
  return {
    ...(draft as unknown as ProjectRecipeDraft),
    source:
      draft.source === 'project-draft' || draftVersion > 0
        ? 'project-draft'
        : 'platform-default',
    draftVersion,
    document: asRecord(draft.document) as ProjectRecipeDraft['document'],
    authoringDigest:
      typeof draft.authoringDigest === 'string' ? draft.authoringDigest : '',
  };
};

export const normalizeRecipeDraftValidation = (
  value: unknown,
): RecipeDraftValidation => {
  const raw = asRecord(value);
  const outputs = Array.isArray(raw.outputs) ? raw.outputs : [];
  return {
    recipeDigest:
      typeof raw.recipeDigest === 'string' ? raw.recipeDigest : undefined,
    resolvedSchemaDigest:
      typeof raw.resolvedSchemaDigest === 'string'
        ? raw.resolvedSchemaDigest
        : undefined,
    sourceGeneration:
      typeof raw.sourceGeneration === 'string'
        ? raw.sourceGeneration
        : undefined,
    outputs: outputs.map((candidate) => {
      const output = asRecord(candidate);
      const fieldNames = Array.isArray(output.fieldNames)
        ? output.fieldNames
            .filter((field): field is string => typeof field === 'string')
            .map((name) => ({ name }))
        : [];
      return {
        name: typeof output.name === 'string' ? output.name : '',
        rootResourceType:
          typeof output.rootResourceType === 'string'
            ? output.rootResourceType
            : '',
        rowGrain: typeof output.rowGrain === 'string' ? output.rowGrain : '',
        columns: normalizeColumns(output.columns ?? fieldNames),
      };
    }),
    diagnostics: Array.isArray(raw.diagnostics)
      ? (raw.diagnostics as RecipeDraftValidation['diagnostics'])
      : [],
  };
};

export const normalizeRecipeDraftPreview = (
  value: unknown,
  requestedOutput: string,
): RecipeDraftPreview => {
  const raw = asRecord(value);
  const nested = isRecord(raw.preview) ? raw.preview : raw;
  const rawOutputs = Array.isArray(nested.outputs) ? nested.outputs : [];
  const selected =
    rawOutputs.find(
      (candidate) => asRecord(candidate).name === requestedOutput,
    ) ?? rawOutputs[0];
  const output = asRecord(selected);
  const outputName =
    typeof nested.output === 'string'
      ? nested.output
      : typeof output.name === 'string'
        ? output.name
        : requestedOutput;
  const rowsValue = nested.rows ?? output.rows;
  let rows: ReadonlyArray<Readonly<Record<string, JSONValue>>> = [];
  if (Array.isArray(rowsValue)) {
    rows = rowsValue.filter(isRecord) as ReadonlyArray<
      Readonly<Record<string, JSONValue>>
    >;
  } else if (typeof rowsValue === 'string') {
    try {
      const parsed: unknown = JSON.parse(rowsValue);
      if (Array.isArray(parsed)) {
        rows = parsed.filter(isRecord) as ReadonlyArray<
          Readonly<Record<string, JSONValue>>
        >;
      }
    } catch {
      rows = [];
    }
  }
  const columns = normalizeColumns(nested.columns ?? output.columns);
  const validation = normalizeRecipeDraftValidation(
    nested.validation ?? {
      recipeDigest: nested.recipeDigest,
      resolvedSchemaDigest: nested.resolvedSchemaDigest,
      sourceGeneration: nested.sourceGeneration,
      outputs: rawOutputs,
      diagnostics: nested.diagnostics,
    },
  );
  return {
    validation,
    output: outputName,
    columns,
    rows,
    rowCount:
      typeof nested.rowCount === 'number'
        ? nested.rowCount
        : typeof output.rowCount === 'number'
          ? output.rowCount
          : rows.length,
  };
};

const unwrapExplorers = (
  value: unknown,
): ReadonlyArray<ExplorerBuilderState> => {
  const raw = asRecord(value);
  return (
    Array.isArray(raw.explorers) ? raw.explorers : value
  ) as ReadonlyArray<ExplorerBuilderState>;
};

export const explorerBuilderApi = gen3Api
  .enhanceEndpoints({ addTagTypes: ['BuilderRecipe', 'BuilderExplorer'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getProjectRecipe: builder.query<ProjectRecipeDraft, ProjectArgs>({
        query: (args) => `${projectPath(args)}/recipe`,
        transformResponse: normalizeProjectRecipeDraft,
        transformErrorResponse: errorResponse,
        providesTags: (_result, _error, args) => [
          { type: 'BuilderRecipe', id: `${args.organization}/${args.project}` },
        ],
      }),
      saveProjectRecipeDraft: builder.mutation<
        ProjectRecipeDraft,
        ProjectArgs & {
          readonly draft: RecipeAuthoringDocument;
          readonly expectedDraftVersion: number;
        }
      >({
        query: ({ draft, expectedDraftVersion, ...project }) => ({
          url: `${projectPath(project)}/recipe/draft`,
          method: 'PUT',
          headers: { 'If-Match': `"${expectedDraftVersion}"` },
          body: { recipe: draft },
        }),
        transformResponse: normalizeProjectRecipeDraft,
        transformErrorResponse: errorResponse,
        invalidatesTags: (_result, _error, args) => [
          { type: 'BuilderRecipe', id: `${args.organization}/${args.project}` },
        ],
      }),
      validateProjectRecipe: builder.mutation<
        RecipeDraftValidation,
        ProjectArgs & { readonly recipe: RecipeAuthoringDocument }
      >({
        query: ({ recipe, ...project }) => ({
          url: `${projectPath(project)}/recipe/validate`,
          method: 'POST',
          body: { recipe },
        }),
        transformResponse: normalizeRecipeDraftValidation,
        transformErrorResponse: errorResponse,
      }),
      previewProjectRecipe: builder.mutation<
        RecipeDraftPreview,
        ProjectArgs & {
          readonly recipe: RecipeAuthoringDocument;
          readonly output: string;
          readonly limit: 10 | 25 | 50 | 100;
        }
      >({
        query: ({ recipe, output, limit, ...project }) => ({
          url: `${projectPath(project)}/recipe/preview`,
          method: 'POST',
          body: { recipe, output, limit },
        }),
        transformResponse: (response, _meta, args) =>
          normalizeRecipeDraftPreview(response, args.output),
        transformErrorResponse: errorResponse,
      }),
      publishProjectRecipe: builder.mutation<
        ProjectRecipeRevision,
        ProjectArgs & {
          readonly expectedDraftVersion: number;
          readonly expectedAuthoringDigest: string;
          readonly outputs?: ReadonlyArray<string>;
        }
      >({
        query: ({
          expectedDraftVersion,
          expectedAuthoringDigest,
          outputs,
          ...project
        }) => ({
          url: `${projectPath(project)}/recipe/publish`,
          method: 'POST',
          body: { expectedDraftVersion, expectedAuthoringDigest, outputs },
        }),
        transformErrorResponse: errorResponse,
        invalidatesTags: (_result, _error, args) => [
          { type: 'BuilderRecipe', id: `${args.organization}/${args.project}` },
        ],
      }),
      getProjectRecipeRevisions: builder.query<
        ReadonlyArray<ProjectRecipeRevision>,
        ProjectArgs
      >({
        query: (args) => `${projectPath(args)}/recipe/revisions`,
        transformErrorResponse: errorResponse,
      }),
      getProjectRecipeRevision: builder.query<
        ProjectRecipeRevision,
        ProjectArgs & { readonly revisionId: string }
      >({
        query: ({ revisionId, ...project }) =>
          `${projectPath(project)}/recipe/revisions/${segment(revisionId)}`,
        transformErrorResponse: errorResponse,
      }),
      getExplorers: builder.query<
        ReadonlyArray<ExplorerBuilderState>,
        ProjectArgs
      >({
        query: (args) => `${projectPath(args)}/explorers`,
        transformResponse: unwrapExplorers,
        transformErrorResponse: errorResponse,
        providesTags: (_result, _error, args) => [
          {
            type: 'BuilderExplorer',
            id: `${args.organization}/${args.project}`,
          },
        ],
      }),
      createExplorer: builder.mutation<
        ExplorerBuilderState,
        ProjectArgs & { readonly configId: string; readonly title: string }
      >({
        query: ({ configId, title, ...project }) => ({
          url: `${projectPath(project)}/explorers`,
          method: 'POST',
          body: { configId, title },
        }),
        transformErrorResponse: errorResponse,
        invalidatesTags: (_result, _error, args) => [
          {
            type: 'BuilderExplorer',
            id: `${args.organization}/${args.project}`,
          },
        ],
      }),
      getExplorer: builder.query<ExplorerBuilderState, ConfigArgs>({
        query: explorerPath,
        transformErrorResponse: errorResponse,
      }),
      renameExplorer: builder.mutation<
        ExplorerBuilderState,
        ConfigArgs & { readonly title: string }
      >({
        query: ({ title, ...args }) => ({
          url: explorerPath(args),
          method: 'PUT',
          body: { title },
        }),
        transformErrorResponse: errorResponse,
        invalidatesTags: (_result, _error, args) => [
          {
            type: 'BuilderExplorer',
            id: `${args.organization}/${args.project}`,
          },
        ],
      }),
      saveExplorerDraft: builder.mutation<
        ExplorerBuilderState,
        ConfigArgs & {
          readonly draft: ExplorerAuthoringDocument;
          readonly expectedDraftVersion: number;
        }
      >({
        query: ({ draft, expectedDraftVersion, ...args }) => ({
          url: `${explorerPath(args)}/draft`,
          method: 'PUT',
          headers: { 'If-Match': `"${expectedDraftVersion}"` },
          body: buildExplorerDraftBody(draft),
        }),
        transformErrorResponse: errorResponse,
      }),
      validateExplorer: builder.mutation<
        { readonly diagnostics: ReadonlyArray<BuilderDiagnostic> },
        ConfigArgs & {
          readonly draft: ExplorerAuthoringDocument;
          readonly recipeRevisionId: string;
        }
      >({
        query: ({ draft, recipeRevisionId, ...args }) => ({
          url: `${explorerPath(args)}/validate`,
          method: 'POST',
          body: buildExplorerValidationBody(draft, recipeRevisionId),
        }),
        transformErrorResponse: errorResponse,
      }),
      publishExplorer: builder.mutation<
        ExplorerConfigRevision,
        ConfigArgs & {
          readonly expectedDraftVersion: number;
          readonly recipeRevisionId: string;
        }
      >({
        query: ({ expectedDraftVersion, recipeRevisionId, ...args }) => ({
          url: `${explorerPath(args)}/publish`,
          method: 'POST',
          body: { expectedDraftVersion, recipeRevisionId },
        }),
        transformErrorResponse: errorResponse,
      }),
      getExplorerRevisions: builder.query<
        ReadonlyArray<ExplorerConfigRevision>,
        ConfigArgs
      >({
        query: explorerRevisionCollectionPath,
        transformErrorResponse: errorResponse,
      }),
      getExplorerRevision: builder.query<
        ExplorerConfigRevision,
        ConfigArgs & { readonly revisionId: string }
      >({
        query: ({ revisionId, ...args }) =>
          explorerRevisionPath({ ...args, revisionId }),
        transformErrorResponse: errorResponse,
      }),
      activateExplorerRevision: builder.mutation<
        ExplorerRelease,
        ConfigArgs & {
          readonly revisionId: string;
          readonly expectedActiveReleaseId: string | null;
        }
      >({
        query: ({ revisionId, expectedActiveReleaseId, ...args }) => ({
          url: activateExplorerRevisionPath({ ...args, revisionId }),
          method: 'POST',
          body: { expectedActiveReleaseId },
        }),
        transformErrorResponse: errorResponse,
      }),
      getResolvedExplorerRelease: builder.query<
        ResolvedExplorerRelease,
        string
      >({
        query: (releaseId) =>
          `${GEN3_GECKO_API}/explorer/releases/${segment(releaseId)}/resolved`,
        transformErrorResponse: errorResponse,
        keepUnusedDataFor: 300,
      }),
    }),
  });

export const {
  useGetProjectRecipeQuery,
  useSaveProjectRecipeDraftMutation,
  useValidateProjectRecipeMutation,
  usePreviewProjectRecipeMutation,
  usePublishProjectRecipeMutation,
  useGetProjectRecipeRevisionsQuery,
  useGetProjectRecipeRevisionQuery,
  useGetExplorersQuery,
  useCreateExplorerMutation,
  useGetExplorerQuery,
  useRenameExplorerMutation,
  useSaveExplorerDraftMutation,
  useValidateExplorerMutation,
  usePublishExplorerMutation,
  useGetExplorerRevisionsQuery,
  useGetExplorerRevisionQuery,
  useActivateExplorerRevisionMutation,
  useGetResolvedExplorerReleaseQuery,
} = explorerBuilderApi;
