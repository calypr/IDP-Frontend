import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import type { PageLoadResult, ServerPageContext } from '../../lib/pageLoader';
import type { ExplorerPageData } from './types';
import { canonicalLoomProjectId } from '@gen3/core';

const emptyExplorerPage = (): ExplorerPageData => ({
  runtime: null,
  sharedFiltersMap: null,
});

export const loadExplorerStateV1 = async (
  context: ServerPageContext,
): Promise<ExplorerPageData | PageLoadResult<ExplorerPageData>> => {
  const project = typeof context.next.query.configId === 'string'
    ? canonicalLoomProjectId(context.next.query.configId)
    : undefined;
  if (!project) {
    context.problems.add({
      severity: 'error',
      source: 'loom',
      status: 404,
      code: 'EXPLORER_NOT_FOUND',
      retryable: false,
      message: 'The requested Explorer is unavailable or you do not have project read access.',
    });
    return emptyExplorerPage();
  }
  // Explorer state is intentionally loaded in the browser. The page is an
  // authenticated, interactive workspace; keeping this request client-side
  // makes it observable in DevTools and lets RTK Query handle retries and
  // session transitions. SSR still supplies navigation and the page shell.
  return { ...emptyExplorerPage(), project };
};

export const ExplorerPageGetServerSideProps = definePageLoader<ExplorerPageData>({
  name: 'Explorer',
  loadNavigation: loadNavigationFromContext,
  load: loadExplorerStateV1,
});
