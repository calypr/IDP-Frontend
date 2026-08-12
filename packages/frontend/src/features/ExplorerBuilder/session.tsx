import React, {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
} from 'react';
import type {
  BuilderDiagnostic,
  BuilderProject,
  ExplorerAuthoringDocument,
  RecipeAuthoringDocument,
  RecipeDraftPreview,
} from '@gen3/core';

export interface PreviewState {
  readonly key: string;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly data?: RecipeDraftPreview;
  readonly diagnostics?: ReadonlyArray<BuilderDiagnostic>;
}

export const PREVIEW_DEBOUNCE_MS = 750;

export const schedulePreview = (
  callback: () => void,
  delay = PREVIEW_DEBOUNCE_MS,
): (() => void) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

export interface DraftConflictState {
  readonly scope: 'recipe' | 'explorer';
  readonly currentVersion?: number;
  readonly currentDigest?: string;
  readonly updatedAt?: string;
  readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
}

export interface ExplorerBuilderSession {
  readonly project: BuilderProject;
  readonly recipeDraft: RecipeAuthoringDocument;
  readonly explorerDraft: ExplorerAuthoringDocument;
  readonly selectedRecipeRevisionId?: string;
  readonly selectedOutput?: string;
  readonly recipeDraftVersion: number;
  readonly explorerDraftVersion: number;
  readonly recipeDirty: boolean;
  readonly explorerDirty: boolean;
  readonly recipeDiagnostics: ReadonlyArray<BuilderDiagnostic>;
  readonly explorerDiagnostics: ReadonlyArray<BuilderDiagnostic>;
  readonly previewByOutput: Readonly<Record<string, PreviewState>>;
  readonly conflict?: DraftConflictState;
}

export type ExplorerBuilderAction =
  | {
      readonly type: 'loadRecipe';
      readonly draft: RecipeAuthoringDocument;
      readonly version: number;
    }
  | { readonly type: 'editRecipe'; readonly draft: RecipeAuthoringDocument }
  | {
      readonly type: 'recipeSaved';
      readonly draft: RecipeAuthoringDocument;
      readonly version: number;
    }
  | {
      readonly type: 'loadExplorer';
      readonly draft: ExplorerAuthoringDocument;
      readonly version: number;
    }
  | { readonly type: 'editExplorer'; readonly draft: ExplorerAuthoringDocument }
  | {
      readonly type: 'explorerSaved';
      readonly draft: ExplorerAuthoringDocument;
      readonly version: number;
    }
  | { readonly type: 'selectRecipeRevision'; readonly revisionId?: string }
  | { readonly type: 'selectOutput'; readonly output?: string }
  | {
      readonly type: 'recipeDiagnostics';
      readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
    }
  | {
      readonly type: 'explorerDiagnostics';
      readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
    }
  | {
      readonly type: 'previewLoading';
      readonly output: string;
      readonly key: string;
    }
  | {
      readonly type: 'previewReady';
      readonly output: string;
      readonly key: string;
      readonly data: RecipeDraftPreview;
    }
  | {
      readonly type: 'previewError';
      readonly output: string;
      readonly key: string;
      readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
    }
  | { readonly type: 'draftConflict'; readonly conflict: DraftConflictState }
  | { readonly type: 'clearDraftConflict' };

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
};

export const canonicalizeAuthoringDocument = (document: unknown): string =>
  JSON.stringify(stableValue(document));

export const buildPreviewCacheKey = async (
  project: BuilderProject,
  recipe: RecipeAuthoringDocument,
  output: string,
  limit: number,
): Promise<string> => {
  const value = `${project.organization}/${project.project}|${output}|${limit}|${canonicalizeAuthoringDocument(recipe)}`;
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle && typeof TextEncoder !== 'undefined') {
    const digest = await cryptoApi.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value),
    );
    return `sha256:${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return `canonical:${value}`;
};

export const createExplorerBuilderSession = (
  project: BuilderProject,
): ExplorerBuilderSession => ({
  project,
  recipeDraft: {},
  explorerDraft: {},
  recipeDraftVersion: 0,
  explorerDraftVersion: 0,
  recipeDirty: false,
  explorerDirty: false,
  recipeDiagnostics: [],
  explorerDiagnostics: [],
    previewByOutput: {},
  });

export const explorerBuilderReducer = (
  state: ExplorerBuilderSession,
  action: ExplorerBuilderAction,
): ExplorerBuilderSession => {
  switch (action.type) {
    case 'loadRecipe':
    case 'recipeSaved':
      return {
        ...state,
        recipeDraft: action.draft,
        recipeDraftVersion: action.version,
        recipeDirty: false,
      };
    case 'editRecipe':
      return { ...state, recipeDraft: action.draft, recipeDirty: true };
    case 'loadExplorer':
    case 'explorerSaved':
      return {
        ...state,
        explorerDraft: action.draft,
        explorerDraftVersion: action.version,
        explorerDirty: false,
      };
    case 'editExplorer':
      return { ...state, explorerDraft: action.draft, explorerDirty: true };
    case 'selectRecipeRevision':
      return { ...state, selectedRecipeRevisionId: action.revisionId };
    case 'selectOutput':
      return { ...state, selectedOutput: action.output };
    case 'recipeDiagnostics':
      return { ...state, recipeDiagnostics: action.diagnostics };
    case 'explorerDiagnostics':
      return { ...state, explorerDiagnostics: action.diagnostics };
    case 'previewLoading':
      return {
        ...state,
        previewByOutput: {
          ...state.previewByOutput,
          [action.output]: { key: action.key, status: 'loading' },
        },
      };
    case 'previewReady': {
      if (state.previewByOutput[action.output]?.key !== action.key)
        return state;
      return {
        ...state,
        previewByOutput: {
          ...state.previewByOutput,
          [action.output]: {
            key: action.key,
            status: 'ready',
            data: action.data,
          },
        },
      };
    }
    case 'previewError': {
      if (state.previewByOutput[action.output]?.key !== action.key)
        return state;
      return {
        ...state,
        previewByOutput: {
          ...state.previewByOutput,
          [action.output]: {
            key: action.key,
            status: 'error',
            diagnostics: action.diagnostics,
          },
        },
      };
    }
    case 'draftConflict':
      return { ...state, conflict: action.conflict };
    case 'clearDraftConflict':
      return { ...state, conflict: undefined };
  }
};

interface ExplorerBuilderContextValue {
  readonly state: ExplorerBuilderSession;
  readonly dispatch: Dispatch<ExplorerBuilderAction>;
}

const ExplorerBuilderContext =
  createContext<ExplorerBuilderContextValue | null>(null);

export const ExplorerBuilderSessionProvider = ({
  project,
  children,
}: PropsWithChildren<{ readonly project: BuilderProject }>) => {
  const [state, dispatch] = useReducer(
    explorerBuilderReducer,
    project,
    createExplorerBuilderSession,
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <ExplorerBuilderContext.Provider value={value}>
      {children}
    </ExplorerBuilderContext.Provider>
  );
};

export const useExplorerBuilderSession = (): ExplorerBuilderContextValue => {
  const value = useContext(ExplorerBuilderContext);
  if (!value) {
    throw new Error(
      'useExplorerBuilderSession must be used within ExplorerBuilderSessionProvider',
    );
  }
  return value;
};
