import type {
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  QueryReturnValue,
} from '@reduxjs/toolkit/query';
import { GEN3_API } from '../../constants';
import { gen3Api } from '../gen3';
import type {
  SyfonIndexDirectory,
  SyfonIndexListResponse,
  SyfonIndexRecord,
} from './types';

export interface GetSyfonIndexRecordsArgs {
  readonly organization: string;
  readonly project: string;
  readonly limit?: number;
  readonly page?: number;
  readonly start?: string;
  readonly path?: string;
}

export interface SyfonIndexBrowseResponse {
  readonly directories: Array<SyfonIndexDirectory>;
  readonly records: Array<SyfonIndexRecord>;
}

const DEFAULT_INDEX_PAGE_LIMIT = 1000;

const buildIndexRequestUrl = ({
  limit,
  organization,
  page,
  path,
  project,
  start,
}: {
  limit: number;
  organization: string;
  page?: number;
  project: string;
  start?: string;
  path?: string;
}): string => {
  const query = new URLSearchParams({
    organization: organization.trim(),
    project: project.trim(),
    limit: String(limit),
  });
  if (typeof path === 'string' && path.trim()) {
    query.set('path', path.trim());
  }

  if (typeof start === 'string' && start.trim()) {
    query.set('start', start.trim());
  } else if (typeof page === 'number') {
    query.set('page', String(page));
  }

  return `${GEN3_API}/index?${query.toString()}`;
};

const fetchSyfonIndexRecords = async ({
  args,
  fetchWithBQ,
}: {
  args: GetSyfonIndexRecordsArgs;
  fetchWithBQ: (
    arg: string | FetchArgs,
  ) =>
    | QueryReturnValue<unknown, FetchBaseQueryError, FetchBaseQueryMeta>
    | PromiseLike<
        QueryReturnValue<unknown, FetchBaseQueryError, FetchBaseQueryMeta>
      >;
}): Promise<
  QueryReturnValue<
    SyfonIndexBrowseResponse,
    FetchBaseQueryError,
    FetchBaseQueryMeta
  >
> => {
  const pageLimit = args.limit ?? DEFAULT_INDEX_PAGE_LIMIT;
  const response = await fetchWithBQ({
    credentials: 'include',
    method: 'GET',
    url: buildIndexRequestUrl({
      limit: pageLimit,
      organization: args.organization,
      page: args.page,
      path: args.path,
      project: args.project,
      start: args.start,
    }),
  });

  if (response.error) {
    return { error: response.error };
  }

  const rawData = (response.data ?? {}) as SyfonIndexListResponse;
  return {
    data: {
      directories: rawData.directories ?? [],
      records: rawData.records ?? [],
    },
    meta: response.meta,
  };
};

export const syfonIndexApi = gen3Api.injectEndpoints({
  endpoints: (builder) => ({
    getSyfonIndexRecords: builder.query<SyfonIndexBrowseResponse, GetSyfonIndexRecordsArgs>({
      async queryFn(args, _api, _extraOptions, fetchWithBQ) {
        return fetchSyfonIndexRecords({ args, fetchWithBQ });
      },
    }),
  }),
});
export const { useGetSyfonIndexRecordsQuery } = syfonIndexApi;
