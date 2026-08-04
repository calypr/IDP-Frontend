import type { PageProps } from '../../lib/pageLoader';
import type { AccessibleOrganizationProject } from '../OrganizationExplorer/types';
import type { FileActionsConfig } from '../../features/CohortBuilder/types';

export type GitExplorerPageProps = PageProps<{
  fileActions?: FileActionsConfig;
}>;

export interface GitProjectPageProps extends GitExplorerPageProps {
  projectRecord?: AccessibleOrganizationProject;
}
