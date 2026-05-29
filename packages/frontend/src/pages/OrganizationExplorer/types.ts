import type { SyfonAccessMethod, SyfonIndexRecord } from '@gen3/core';
import type { FileActionsConfig } from '../../features/CohortBuilder/types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export interface AccessibleOrganizationProject {
  readonly organization: string;
  readonly project: string;
  readonly resourcePath: string;
}

export interface OrganizationGroup {
  readonly organization: string;
  readonly projects: Array<AccessibleOrganizationProject>;
}

export interface SyfonRepoFile {
  readonly accessMethods: Array<SyfonAccessMethod>;
  readonly canonicalFilename: string;
  readonly checksums: Record<string, string>;
  readonly controlledAccess: Array<string>;
  readonly createdTime?: string;
  readonly description?: string;
  readonly did: string;
  readonly displayName: string;
  readonly mimeType?: string;
  readonly pathSegments: Array<string>;
  readonly record: SyfonIndexRecord;
  readonly size?: number;
  readonly updatedTime?: string;
  readonly version?: string;
}

export interface RepoDirectoryEntry {
  readonly itemCount?: number;
  readonly name: string;
  readonly pathSegments: Array<string>;
  readonly type: 'directory';
}

export interface RepoFileEntry {
  readonly file: SyfonRepoFile;
  readonly name: string;
  readonly type: 'file';
}

export type RepoListingEntry = RepoDirectoryEntry | RepoFileEntry;

export type OrganizationExplorerPageProps = NavPageLayoutProps & {
  fileActions?: FileActionsConfig;
};
