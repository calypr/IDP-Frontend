import type { DirItem, DirectoryContents, ProjectItem } from '@gen3/core';

export interface BrowserColumn {
  id: string;
  items?: Array<DirItem | ProjectItem>;
  metadata?: DirItem;
  loading?: boolean;
}

export const getDirectoryCacheKey = (
  projectId: string,
  path: ReadonlyArray<string>,
): string => `${projectId}::${path.join('/')}`;

export const buildBrowserColumns = ({
  projectItems,
  selectedProject,
  selectedPath,
  selectedFile,
  directoryCache,
  isLoadingProjects,
  loadingPathKey,
}: {
  projectItems?: Array<ProjectItem>;
  selectedProject: string | null;
  selectedPath: ReadonlyArray<string>;
  selectedFile: DirItem | null;
  directoryCache: Record<string, DirectoryContents>;
  isLoadingProjects: boolean;
  loadingPathKey: string | null;
}): Array<BrowserColumn> => {
  if (!Array.isArray(projectItems)) {
    return isLoadingProjects
      ? [{ id: 'root-projects-loading', loading: true }]
      : [{ id: 'root-projects', items: [] }];
  }

  const columns: Array<BrowserColumn> = [
    { id: 'root-projects', items: projectItems },
  ];

  if (!selectedProject) {
    return columns;
  }

  const pathsToRender: Array<ReadonlyArray<string>> = [
    [],
    ...selectedPath.map((_segment, index) => selectedPath.slice(0, index + 1)),
  ];

  for (const path of pathsToRender) {
    const cacheKey = getDirectoryCacheKey(selectedProject, path);
    const cachedContents = directoryCache[cacheKey];

    if (cachedContents) {
      columns.push({
        id: `dir-${selectedProject}-${path.join('/') || 'root'}`,
        items: cachedContents.items,
      });
      continue;
    }

    columns.push({
      id: `dir-loading-${selectedProject}-${path.join('/') || 'root'}`,
      loading: loadingPathKey === cacheKey,
    });
  }

  if (selectedFile) {
    columns.push({
      id: `file-metadata-${selectedFile.id}`,
      metadata: selectedFile,
    });
  }

  return columns;
};

export const isBrowserItemSelected = ({
  item,
  columnIndex,
  selectedProject,
  selectedPath,
  selectedFile,
}: {
  item: DirItem | ProjectItem;
  columnIndex: number;
  selectedProject: string | null;
  selectedPath: ReadonlyArray<string>;
  selectedFile: DirItem | null;
}): boolean => {
  if (columnIndex === 0) {
    return selectedProject === item.name;
  }

  if (item.type === 'file') {
    return (
      selectedFile?.id === item.id && columnIndex === selectedPath.length + 1
    );
  }

  return selectedPath[columnIndex - 1] === item.name;
};
