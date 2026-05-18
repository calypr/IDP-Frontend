import type {
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  QueryReturnValue,
} from '@reduxjs/toolkit/query';
import { GEN3_API } from '../../constants';
import { gen3Api } from '../gen3';
import type { SyfonIndexListResponse, SyfonIndexRecord } from './types';
import { normalizeSyfonResourcePath } from './utils';

export interface GetSyfonIndexRecordsArgs {
  readonly organization: string;
  readonly project: string;
  readonly limit?: number;
  readonly page?: number;
}

const buildExactProjectScope = (
  organization: string,
  project: string,
): string =>
  normalizeSyfonResourcePath(
    `/organization/${organization.trim()}/project/${project.trim()}`,
  );

const recordMatchesExactProjectScope = (
  record: SyfonIndexRecord,
  organization: string,
  project: string,
): boolean => {
  const normalizedOrganization = organization.trim();
  const normalizedProject = project.trim();
  const exactScope = buildExactProjectScope(normalizedOrganization, normalizedProject);

  const controlledAccess = (record.controlled_access ?? [])
    .map((resource) => normalizeSyfonResourcePath(resource))
    .filter(Boolean);

  if (controlledAccess.includes(exactScope)) {
    return true;
  }

  return (
    record.organization?.trim() === normalizedOrganization &&
    record.project?.trim() === normalizedProject
  );
};

const DEFAULT_INDEX_PAGE_LIMIT = 1000;

const buildIndexRequestUrl = ({
  limit,
  organization,
  page,
  project,
}: {
  limit: number;
  organization: string;
  page?: number;
  project: string;
}): string => {
  const query = new URLSearchParams({
    organization: organization.trim(),
    project: project.trim(),
    limit: String(limit),
  });

  if (typeof page === 'number') {
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
    Array<SyfonIndexRecord>,
    FetchBaseQueryError,
    FetchBaseQueryMeta
  >
> => {
  const pageLimit = args.limit ?? DEFAULT_INDEX_PAGE_LIMIT;

  if (typeof args.page === 'number') {
    const response = await fetchWithBQ({
      credentials: 'include',
      method: 'GET',
      url: buildIndexRequestUrl({
        limit: pageLimit,
        organization: args.organization,
        page: args.page,
        project: args.project,
      }),
    });

    if (response.error) {
      return { error: response.error };
    }

    const rawData = (response.data ?? {}) as SyfonIndexListResponse;
    return {
      data: (rawData.records ?? []).filter((record) =>
        recordMatchesExactProjectScope(record, args.organization, args.project),
      ),
      meta: response.meta,
    };
  }

  const allRecords: Array<SyfonIndexRecord> = [];
  let currentPage = 0;

  while (true) {
    const response = await fetchWithBQ({
      credentials: 'include',
      method: 'GET',
      url: buildIndexRequestUrl({
        limit: pageLimit,
        organization: args.organization,
        page: currentPage,
        project: args.project,
      }),
    });

    if (response.error) {
      return { error: response.error };
    }

    const rawData = (response.data ?? {}) as SyfonIndexListResponse;
    const pageRecords = (rawData.records ?? []).filter((record) =>
      recordMatchesExactProjectScope(record, args.organization, args.project),
    );

    allRecords.push(...pageRecords);

    if ((rawData.records ?? []).length < pageLimit) {
      break;
    }

    currentPage += 1;
  }

  return { data: allRecords };
};

export const syfonIndexApi = gen3Api.injectEndpoints({
  endpoints: (builder) => ({
    getSyfonIndexRecords: builder.query<
      Array<SyfonIndexRecord>,
      GetSyfonIndexRecordsArgs
    >({
      async queryFn(args, _api, _extraOptions, fetchWithBQ) {
        return fetchSyfonIndexRecords({ args, fetchWithBQ });
      },
    }),
  }),
});
export const { useGetSyfonIndexRecordsQuery } = syfonIndexApi;
