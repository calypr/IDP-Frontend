import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  useGetAuthzMappingsQuery,
  useGetProjectViewBuilderQuery,
  userHasMethodForServiceOnResource,
} from '@gen3/core';

type ProjectWorkspaceTabKey = 'git' | 'presentation' | 'explorer' | 'storage';

interface ProjectWorkspaceTabsProps {
  readonly activeTab: ProjectWorkspaceTabKey;
  readonly children: React.ReactNode;
  readonly hasExplorerConfig: boolean;
  readonly organization: string;
  readonly project: string;
  readonly gitHref?: string;
  readonly presentationHref?: string;
  readonly explorerHref?: string;
  readonly storageHref?: string;
  readonly toolbarContent?: React.ReactNode;
  readonly stickyHeader?: boolean;
  readonly belowTabsContent?: React.ReactNode;
}

const ProjectWorkspaceTabs = ({
  activeTab,
  children,
  hasExplorerConfig,
  organization,
  project,
  gitHref,
  presentationHref,
  explorerHref,
  storageHref,
  toolbarContent,
  stickyHeader = false,
  belowTabsContent,
}: ProjectWorkspaceTabsProps) => {
  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();
  const { data: viewSettings } = useGetProjectViewBuilderQuery(
    { project: `${organization}/${project}` },
    { skip: !organization || !project || hasExplorerConfig },
  );
  const hasConfiguredExplorer =
    hasExplorerConfig ||
    Boolean(viewSettings?.configs.some((view) => view.revisionId));

  const hasGitAccess = useMemo(() => {
    if (!organization || !project) return false;
    const candidatePaths = [
      `/programs/${organization}/projects/${project}`,
      `/programs/${organization}/projects`,
      `/programs/${organization}`,
      '/programs',
      '/',
      '*',
    ];
    return candidatePaths.some((path) =>
      userHasMethodForServiceOnResource('update', '*', path, authzMapping),
    );
  }, [organization, project, authzMapping]);

  const hasReadAccess = useMemo(() => {
    if (!organization || !project) return false;
    const candidatePaths = [
      `/programs/${organization}/projects/${project}`,
      `/programs/${organization}/projects`,
      `/programs/${organization}`,
      '/programs',
      '/',
      '*',
    ];
    return candidatePaths.some((path) =>
      userHasMethodForServiceOnResource('read', '*', path, authzMapping),
    );
  }, [organization, project, authzMapping]);

  const gitBaseHref =
    gitHref ||
    `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`;
  const presentationBaseHref =
    presentationHref ||
    `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/presentation`;
  const explorerBaseHref =
    explorerHref ||
    `/Explorer/${encodeURIComponent(`${organization}/${project}`)}`;
  const storageBaseHref =
    storageHref ||
    `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/storage`;

  const visibleTabs = useMemo(
    () => [
      {
        key: 'presentation' as const,
        label: 'Home',
        href: presentationBaseHref,
      },
      ...(hasConfiguredExplorer || hasGitAccess || activeTab === 'explorer'
        ? [
            {
              key: 'explorer' as const,
              label: 'Explorer',
              href: explorerBaseHref,
            },
          ]
        : []),
      ...(hasGitAccess || activeTab === 'git'
        ? [
            {
              key: 'git' as const,
              label: 'Source',
              href: gitBaseHref,
            },
          ]
        : []),
      ...(hasReadAccess || activeTab === 'storage'
        ? [
            {
              key: 'storage' as const,
              label: 'Storage',
              href: storageBaseHref,
            },
          ]
        : []),
    ],
    [
      explorerBaseHref,
      gitBaseHref,
      hasConfiguredExplorer,
      presentationBaseHref,
      storageBaseHref,
      hasReadAccess,
      hasGitAccess,
      activeTab,
    ],
  );

  if (!organization || !project) {
    return <>{children}</>;
  }

  return (
    <div>
      <div
        className={`border-b border-slate-200 bg-white ${stickyHeader ? 'sticky top-0 z-20' : ''}`}
      >
        <div className="flex min-h-[3rem] flex-wrap items-center gap-x-6 px-4">
          <div
            aria-label={`Project workspaces for ${organization}/${project}`}
            className="flex self-stretch gap-5"
            role="tablist"
          >
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  aria-selected={isActive}
                  className={`rounded-none border-0 border-b-2 bg-transparent px-0 pb-3 pt-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'border-[#2f5aac] text-[#2f5aac]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                  href={tab.href}
                  key={tab.key}
                  role="tab"
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          {toolbarContent ? (
            <div className="min-w-0 flex-[1_1_18rem]">{toolbarContent}</div>
          ) : null}
        </div>
      </div>
      {belowTabsContent ? <div>{belowTabsContent}</div> : null}

      <div>{children}</div>
    </div>
  );
};

export default ProjectWorkspaceTabs;
