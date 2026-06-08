import type { NavPageLayoutProps } from '../../features/Navigation';
import type { AccessibleOrganizationProject } from '../OrganizationExplorer/types';

export type GitExplorerPageProps = NavPageLayoutProps;

export interface GitProjectPageProps extends GitExplorerPageProps {
  projectRecord?: AccessibleOrganizationProject;
}
