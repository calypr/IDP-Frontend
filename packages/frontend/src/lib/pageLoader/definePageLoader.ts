import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
} from 'next';
import type { NavPageLayoutProps } from '../../features/Navigation';
import { createServerPageContext } from './context';
import {
  normalizePageProblem,
  toSerializablePageProblem,
} from './errors';
import type {
  PageLoadProblem,
  PageLoadResult,
  ServerPageContext,
} from './types';

const fallbackNavigation = (): NavPageLayoutProps => ({
  headerProps: {
    topBar: { items: [], loginButtonVisibility: 'hidden' as any },
    navigation: { items: [] },
    banners: [],
    leftnav: [],
    basePage: false,
  },
  footerProps: {
    rightSection: { columns: [], basePage: false },
    basePage: false,
  },
  headerMetadata: {
    title: 'Gen3',
    content: 'Gen3',
    key: 'gen3-common-page',
  },
});

const isPageLoadResult = <T extends object>(
  value: T | PageLoadResult<T>,
): value is PageLoadResult<T> =>
  typeof value === 'object' && value !== null && 'kind' in value;

type LoaderData<TProps extends object> = Omit<
  TProps,
  keyof NavPageLayoutProps | 'pageProblems'
>;

export const definePageLoader = <
  TProps extends object = Record<string, any>,
>(definition: {
  readonly name: string;
  readonly load: (
    context: ServerPageContext,
  ) => Promise<LoaderData<TProps> | PageLoadResult<LoaderData<TProps>>>;
  readonly fallback?: (problem: PageLoadProblem) => LoaderData<TProps>;
  readonly loadNavigation: (
    context: ServerPageContext,
  ) => Promise<NavPageLayoutProps>;
}): GetServerSideProps =>
  async (
    next: GetServerSidePropsContext,
  ): Promise<GetServerSidePropsResult<any>> => {
    const context = createServerPageContext(next, definition.loadNavigation);
    const [navigationResult, dataResult] = await Promise.allSettled([
      context.loadNavigation(),
      definition.load(context),
    ]);

    if (dataResult.status === 'fulfilled' && isPageLoadResult(dataResult.value)) {
      if ('redirect' in dataResult.value) {
        return { redirect: dataResult.value.redirect };
      }
      if (dataResult.value.kind === 'notFound') return { notFound: true };
    }

    let navigation: NavPageLayoutProps;
    let navigationProblem: PageLoadProblem | undefined;
    if (navigationResult.status === 'fulfilled') {
      navigation = navigationResult.value;
    } else {
      navigationProblem = normalizePageProblem(navigationResult.reason, {
        source: 'navigation',
      });
      navigation = fallbackNavigation();
    }

    let data: LoaderData<TProps>;
    let dataProblem: PageLoadProblem | undefined;
    if (dataResult.status === 'fulfilled') {
      if (isPageLoadResult(dataResult.value)) {
        if (!('props' in dataResult.value)) {
          throw new Error(
            `${definition.name} returned an invalid terminal page result`,
          );
        }
        data = dataResult.value.props;
      } else {
        data = dataResult.value;
      }
    } else {
      dataProblem = normalizePageProblem(dataResult.reason, {
        source: 'content',
      });
      data = definition.fallback
        ? definition.fallback(dataProblem)
        : ({} as LoaderData<TProps>);
    }

    const pageProblems = [
      ...context.problems.all,
      ...(navigationProblem ? [navigationProblem] : []),
      ...(dataProblem ? [dataProblem] : []),
    ].map(toSerializablePageProblem);
    const blockingProblem = dataProblem ?? navigationProblem;
    if (blockingProblem) next.res.statusCode = blockingProblem.status;

    return {
      props: {
        ...navigation,
        ...data,
        pageProblems,
      },
    };
  };
