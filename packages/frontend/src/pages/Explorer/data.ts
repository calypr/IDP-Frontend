import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import type { PageLoadResult, ServerPageContext } from '../../lib/pageLoader';
import type { ExplorerPageData } from './types';
import {
  assertExplorerStateV1,
  canonicalLoomProjectId,
  encodeLoomProjectPath,
} from '@gen3/core';
import { normalizePageProblem } from '../../lib/pageLoader/errors';

const emptyExplorerPage = (): ExplorerPageData => ({
  runtime: null,
  sharedFiltersMap: null,
});

export const loadExplorerStateV1 = async (
  context: ServerPageContext,
): Promise<ExplorerPageData | PageLoadResult<ExplorerPageData>> => {
  const project =
    typeof context.next.query.configId === 'string'
      ? canonicalLoomProjectId(context.next.query.configId)
      : undefined;
  if (!project) {
    context.problems.add({
      severity: 'error',
      source: 'loom',
      status: 404,
      code: 'EXPLORER_NOT_FOUND',
      retryable: false,
      message:
        'The requested Explorer is unavailable or you do not have project read access.',
    });
    return emptyExplorerPage();
  }
  const explorerId =
    typeof context.next.query.explorerId === 'string'
      ? context.next.query.explorerId
      : 'default';
  const endpoint = `/api/v1/projects/${encodeLoomProjectPath(project)}/explorers/${encodeURIComponent(explorerId)}`;

  try {
    const response = await context.loom.get<unknown>(endpoint);
    const payload =
      typeof response === 'object' && response !== null && 'data' in response
        ? (response as { readonly data: unknown }).data
        : response;
    const explorerState = assertExplorerStateV1(payload);
    if (!explorerState.runtime) {
      const error = new Error(
        'Loom returned Explorer state without its server-generated runtime.',
      ) as Error & { status: number; code: string; retryable: boolean };
      error.status = 422;
      error.code = 'EXPLORER_RUNTIME_REQUIRED';
      error.retryable = false;
      throw error;
    }
    return {
      runtime: explorerState.runtime,
      project: explorerState.project,
      sharedFiltersMap: null,
    };
  } catch (error) {
    // A browser revalidation still runs after hydration. Keep an SSR failure
    // non-blocking so a refreshed session or transient Loom recovery can win.
    context.problems.add(
      normalizePageProblem(error, {
        source: 'loom',
        severity: 'warning',
        configPath: endpoint,
      }),
    );
    return { ...emptyExplorerPage(), project };
  }
};

export const ExplorerPageGetServerSideProps =
  definePageLoader<ExplorerPageData>({
    name: 'Explorer',
    loadNavigation: loadNavigationFromContext,
    load: loadExplorerStateV1,
  });
