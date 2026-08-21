import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  useGetAuthzMappingsQuery,
  useGetExplorerStateV1Query,
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
}: ProjectWorkspaceTabsProps) => {
  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();
  const { data: repositoryExplorer } = useGetExplorerStateV1Query(
    { project: `${organization}/${project}`, explorerId: 'default' },
    { skip: !organization || !project || hasExplorerConfig },
  );
  const hasConfiguredExplorer =
    hasExplorerConfig || Boolean(repositoryExplorer);

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
      <div className="border-b border-slate-200 bg-white">
        <div className="flex min-h-[3rem] items-center gap-6 px-4">
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
            <div className="min-w-0 flex-1">{toolbarContent}</div>
          ) : null}
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
};

export default ProjectWorkspaceTabs;
