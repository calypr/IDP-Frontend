import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useGetGeckoProjectsQuery } from '@gen3/core';
import type { GeckoProjectRecord } from '@gen3/core';

const EMPTY_PROJECTS: readonly GeckoProjectRecord[] = [];

const projectFromResourcePath = (resourcePath: string): string | null => {
  const parts = resourcePath.split('/').filter(Boolean);
  if (parts.length < 4 || parts[0] !== 'programs' || parts[2] !== 'projects') {
    return null;
  }
  return `${parts[1]}-${parts.slice(3).join('-')}`;
};

export const projectIDFromGeckoProject = (
  project: GeckoProjectRecord,
): string | null => {
  if (project.organization && project.project) {
    return `${project.organization}-${project.project}`;
  }
  return projectFromResourcePath(project.resourcePath);
};

export interface QueryProjectSelectorState {
  readonly projects: readonly GeckoProjectRecord[];
  readonly projectIDs: readonly string[];
  readonly selectedProjectIDs: readonly string[];
  readonly isLoading: boolean;
  readonly isUnavailable: boolean;
  readonly setSelectedProjectIDs: (projectIDs: string[]) => void;
}

export const useQueryProjectSelector = (): QueryProjectSelectorState => {
  const router = useRouter();
  const { data, isLoading } = useGetGeckoProjectsQuery();
  const projects = data ?? EMPTY_PROJECTS;
  const projectIDs = useMemo(
    () =>
      projects
        .map(projectIDFromGeckoProject)
        .filter((value): value is string => Boolean(value)),
    [projects],
  );
  const queryValue = router.query.project_id ?? router.query.project;
  const requestedProjectIDs = useMemo(
    () =>
      (Array.isArray(queryValue) ? queryValue : [queryValue]).filter(
        (value): value is string => typeof value === 'string' && value !== '',
      ),
    [queryValue],
  );
  const [selectedProjectIDs, setSelectedProjectIDsState] =
    useState<string[]>(requestedProjectIDs);

  useEffect(() => {
    if (requestedProjectIDs.length > 0) {
      setSelectedProjectIDsState(requestedProjectIDs);
      if (router.query.project !== undefined && router.isReady) {
        const query: Record<string, string | string[] | undefined> = {
          ...router.query,
          project_id:
            requestedProjectIDs.length === 1
              ? requestedProjectIDs[0]
              : requestedProjectIDs,
        };
        delete query.project;
        void router.replace({ pathname: router.pathname, query }, undefined, {
          shallow: true,
        });
      }
      return;
    }
    if (!isLoading && projectIDs.length === 1) {
      setSelectedProjectIDsState([projectIDs[0]]);
    }
  }, [isLoading, projectIDs, requestedProjectIDs, router]);

  const setSelectedProjectIDs = useCallback(
    (nextProjectIDs: string[]) => {
      setSelectedProjectIDsState(nextProjectIDs);
      const query: Record<string, string | string[] | undefined> = {
        ...router.query,
      };
      delete query.project;
      if (nextProjectIDs.length > 0) {
        query.project_id =
          nextProjectIDs.length === 1 ? nextProjectIDs[0] : nextProjectIDs;
      } else {
        delete query.project_id;
      }
      void router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
      });
    },
    [router],
  );

  return {
    projects,
    projectIDs,
    selectedProjectIDs,
    isLoading,
    isUnavailable: selectedProjectIDs.some(
      (projectID) => !projectIDs.includes(projectID),
    ),
    setSelectedProjectIDs,
  };
};
