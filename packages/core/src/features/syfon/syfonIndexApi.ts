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
import { normalizeSyfonResourcePath } from './utils';

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

const buildExactProjectScope = (
  organization: string,
  project: string,
): string =>
  normalizeSyfonResourcePath(
    `/programs/${organization.trim()}/projects/${project.trim()}`,
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

const getPageCursor = (record: SyfonIndexRecord): string | null => {
  const did = record.did?.trim();
  if (did) return did;
  const id = record.id?.trim();
  return id || null;
};

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
  if (typeof path !== 'undefined') {
    query.set('path', path);
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

  if (typeof args.start === 'string' || typeof args.page === 'number') {
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
        records: (rawData.records ?? []).filter((record) =>
          recordMatchesExactProjectScope(record, args.organization, args.project),
        ),
      },
      meta: response.meta,
    };
  }

  const allRecords: Array<SyfonIndexRecord> = [];
  let directories: Array<SyfonIndexDirectory> = [];
  const seenStarts = new Set<string>();
  const fetchPage = (start?: string) =>
    fetchWithBQ({
      credentials: 'include',
      method: 'GET',
      url: buildIndexRequestUrl({
        limit: pageLimit,
        organization: args.organization,
        path: args.path,
        project: args.project,
        start,
      }),
    });

  let nextPagePromise:
    | PromiseLike<
        QueryReturnValue<unknown, FetchBaseQueryError, FetchBaseQueryMeta>
      >
    | QueryReturnValue<unknown, FetchBaseQueryError, FetchBaseQueryMeta>
    | null = fetchPage();

  while (nextPagePromise) {
    const response = await nextPagePromise;

    if (response.error) {
      return { error: response.error };
    }

    const rawData = (response.data ?? {}) as SyfonIndexListResponse;
    if (directories.length === 0) {
      directories = rawData.directories ?? [];
    }
    const rawRecords = rawData.records ?? [];
    const lastRecord = rawRecords[rawRecords.length - 1];
    const nextStart = rawRecords.length >= pageLimit ? getPageCursor(lastRecord) : null;

    if (nextStart && !seenStarts.has(nextStart)) {
      seenStarts.add(nextStart);
      nextPagePromise = fetchPage(nextStart);
    } else {
      nextPagePromise = null;
    }

    const pageRecords = (rawData.records ?? []).filter((record) =>
      recordMatchesExactProjectScope(record, args.organization, args.project),
    );

    allRecords.push(...pageRecords);
  }

  return { data: { directories, records: allRecords } };
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
