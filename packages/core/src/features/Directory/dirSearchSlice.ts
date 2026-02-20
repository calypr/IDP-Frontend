import { DIR_SEARCH_API } from '../../constants';
import { gen3Api } from '../gen3';

export interface ProjectItem {
  readonly id: string;
  readonly name: string;
  readonly type: 'project';
}

export interface DirItem {
  readonly id: string;
  readonly name: string;
  readonly type: 'directory' | 'file';
  readonly rawData?: DocumentReferenceData | DirectoryData; // Store raw data for file metadata display
}

interface DirectoryData {
  readonly auth_resource_path: string;
  readonly child: ReadonlyArray<{ readonly reference: string }>;
  readonly id: string;
  readonly name: string;
  readonly resourceType: 'Directory';
}

export interface DocumentReferenceData {
  readonly auth_resource_path?: string;
  readonly content?: ReadonlyArray<{
    readonly attachment?: {
      readonly extension?: ReadonlyArray<{
        readonly url?: string;
        readonly valueString?: string;
      }>;
      readonly size?: number;
      readonly title?: string;
      readonly url?: string;
    };
  }>;
  readonly docStatus?: string;
  readonly id: string;
  readonly identifier?: ReadonlyArray<{
    readonly system?: string;
    readonly use?: string;
    readonly value?: string;
  }>;
  readonly resourceType?: string;
  readonly status?: string;
  readonly subject?: {
    readonly reference?: string;
  };
}

interface RawDirItem {
  readonly id: string;
  readonly label: 'Directory' | 'DocumentReference';
  readonly data: DirectoryData | DocumentReferenceData;
}

const processPath = (path: string) => {
  const parts = path.split('/');
  if (parts.length > 4) {
    return [parts[2], parts[4]].join('-');
  }
  return path;
};

/**
 * RTK Query endpoints for directory search (projects and path-based contents)
 */
export const dirSearchApi = gen3Api.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Fetches the initial list of projects from the root endpoint.
     * @returns Array of project items
     */
    getDirectoryProjects: builder.query<ProjectItem[], void>({
      query: () => ({
        url: `${DIR_SEARCH_API}`,
        method: 'GET',
        credentials: 'include',
      }),
      transformResponse: (rawData: string[]) => {
        return rawData.map((path) => ({
          id: path,
          name: processPath(path),
          type: 'project' as const,
        }));
      },
    }),
    /**
     * Fetches directory contents for a given project and POSIX path.
     * @param params - { projectId: string; path: string[] }
     * @returns Array of directory/file items, sorted (dirs first, then alphabetical)
     */
    getDirectoryContents: builder.query<
      DirItem[],
      { readonly projectId: string; readonly path: readonly string[] }
    >({
      query: (params) => {
        const directoryPath = `/${params.path.join('/')}`;
        return {
          url: `${DIR_SEARCH_API}/${params.projectId}?directory=${directoryPath}`,
          method: 'GET',
          credentials: 'include',
        };
      },
      transformResponse: (rawData: RawDirItem[]): DirItem[] => {
        return rawData
          .map((item): DirItem => {
            const isDirectory = item.label === 'Directory';
            const name = isDirectory
              ? (item.data as DirectoryData).name
              : (
                  item.data as DocumentReferenceData
                ).content?.[0]?.attachment?.title
                  ?.split('/')
                  .pop() || 'Unknown File';
            return {
              id: item.id,
              name,
              type: isDirectory ? 'directory' : ('file' as const),
              rawData: item.data, // Store raw data for file metadata
            };
          })
          .sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
          });
      },
    }),
  }),
});

export const { useGetDirectoryProjectsQuery, useGetDirectoryContentsQuery } =
  dirSearchApi;
