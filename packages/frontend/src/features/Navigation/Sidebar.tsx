import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  useGetAuthzMappingsQuery,
  userHasMethodForServiceOnResource,
  resourcePathFromProjectID,
  useGetGeckoProjectsQuery,
} from '@gen3/core';
import { useSidebarContext } from './SidebarContext';
import type {
  LeftNavBarProps,
  SidebarProps,
  SidebarState,
  UseResponsiveSidebarResult,
} from './types';

export function useResponsiveSidebar(
  leftNavDisabled: boolean,
): UseResponsiveSidebarResult {
  const { userOpened, buttonState, toggleSidebar, resizeState } =
    useSidebarContext();

  // Determine the final visible state:
  const finalState: SidebarState = leftNavDisabled
    ? 'closed'
    : // 1. Force close if screen is small AND user hasn't opened it.
      resizeState === 'closed' && !userOpened
      ? 'closed'
      : // 2. Otherwise, respect the button's last state.
        buttonState;

  return { finalState, toggleButton: toggleSidebar };
}
const projectRepoHref = (organization: string, project: string) =>
  `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`;

const fallbackProjectThumbnailURL = '/icons/calypr-mark-mono.svg';
const isProjectThumbnailIcon = (icon?: string): boolean =>
  Boolean(
    icon &&
      (icon.includes('/api/gecko/projects/') ||
        icon.includes('/gecko/git/projects/')),
  );

const SidebarContent = ({
  items,
  state,
  geckoProjects,
}: SidebarProps & { geckoProjects: Array<any> }) => {
  const router = useRouter();
  const { expandedItems, setExpandedItems, toggleSidebar } =
    useSidebarContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const showNewProjectButton = true;

  const combinedItems = useMemo<Array<LeftNavBarProps>>(() => {
    const projectItems: Array<LeftNavBarProps> = geckoProjects
      .map((project) => {
        const parts = project.resourcePath.split('/').filter(Boolean);
        const organization = parts[1] || '';
        const projectName = parts[3] || '';
        const title =
          project.configData?.title?.trim() || projectName || organization;
        const href = projectRepoHref(organization, projectName);

        const matchingNavItem = items?.find(
          (item) => item.href === href || item.title === title,
        );

        const icon =
          matchingNavItem?.icon ||
          project.thumbnail_url ||
          fallbackProjectThumbnailURL;
        const iconNode = matchingNavItem?.iconNode;

        return {
          title,
          description: organization,
          href,
          icon,
          iconNode,
          perms: '',
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title));

    return projectItems;
  }, [geckoProjects, items]);

  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();

  const hasAccess = (perms: string | undefined) => {
    if (!perms) return true;
    return userHasMethodForServiceOnResource(
      'read',
      '*',
      resourcePathFromProjectID(perms),
      authzMapping,
    );
  };

  // Filter items and subItems based on permissions, and exclude 'home' and 'directory structure'
  const visibleItems = combinedItems
    .filter(
      (item) =>
        hasAccess(item.perms) &&
        item.title.trim().toLowerCase() !== 'home' &&
        item.title.trim().toLowerCase() !== 'directory structure',
    )
    .map((item) => ({
      ...item,
      subItems: item.subItems?.filter(
        (sub: LeftNavBarProps) =>
          hasAccess(sub.perms) &&
          sub.title.trim().toLowerCase() !== 'home' &&
          sub.title.trim().toLowerCase() !== 'directory structure',
      ),
    }));

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const projectItems = useMemo(
    () =>
      visibleItems
        .filter((item) => !item.subItems?.length)
        .filter((item) => {
          if (!normalizedSearchQuery) return true;
          return (
            item.title.toLowerCase().includes(normalizedSearchQuery) ||
            item.description.toLowerCase().includes(normalizedSearchQuery)
          );
        }),
    [normalizedSearchQuery, visibleItems],
  );
  const groupedItems = visibleItems.filter((item) => item.subItems?.length);
  const defaultProjectCount = 6;
  const visibleProjectItems =
    showAllProjects || normalizedSearchQuery
      ? projectItems
      : projectItems.slice(0, defaultProjectCount);
  const renderItemIcon = (
    item: Pick<LeftNavBarProps, 'icon' | 'iconNode' | 'title'>,
    invertOnDark = false,
  ) => {
    if (item.iconNode) {
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-600">
          {item.iconNode}
        </span>
      );
    }
    if (!item.icon) {
      return null;
    }
    return (
      <span className="relative h-6 w-6 shrink-0">
        <Image
          src={item.icon}
          alt={item.title}
          fill
          className={invertOnDark ? 'object-contain dark:invert' : 'object-contain'}
          unoptimized={isProjectThumbnailIcon(item.icon)}
        />
      </span>
    );
  };

  return (
    <>
      <button
        aria-label="Close navigation"
        className={`fixed inset-0 top-[var(--gen3-header-height)] z-30 bg-slate-900/18 transition-opacity duration-300 ${
          state === 'open'
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        onClick={toggleSidebar}
        type="button"
      />
      <aside
        className={`
          fixed top-[var(--gen3-header-height)] bottom-0 left-0 z-40
          w-80 flex flex-col bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-out shadow-xl overflow-hidden
          ${state === 'open' ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <nav className="flex flex-col flex-1 p-3 overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="text-lg font-semibold text-slate-900">
                  Projects
                </div>
                {showNewProjectButton ? (
                  <Link
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-700"
                    href="/git/new"
                    onClick={() => toggleSidebar()}
                  >
                    New
                  </Link>
                ) : null}
              </div>
              <div className="px-2">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                  onChange={(event) =>
                    setSearchQuery(event.currentTarget.value)
                  }
                  placeholder="Find a project..."
                  type="text"
                  value={searchQuery}
                />
              </div>
              <ul className="space-y-1">
                {visibleProjectItems.map((item) => {
                  const isActive = router.asPath === item.href;

                  return (
                    <li key={item.title} className="flex flex-col">
                      <Link
                        href={item.href}
                        onClick={() => toggleSidebar()}
                        className={`
                          flex items-center px-3 py-1.5 rounded-lg text-gray-900 dark:text-white
                          transition-colors justify-start min-w-0
                          ${
                            isActive
                              ? 'bg-gray-100 dark:bg-gray-700 font-semibold'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }
                        `}
                      >
                        {renderItemIcon(item)}
                        <span className="ml-3 min-w-0">
                          <span className="block truncate text-[13px] leading-5">
                            {item.title}
                          </span>
                          <span className="block truncate text-[11px] leading-4 text-slate-500">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {!normalizedSearchQuery &&
              projectItems.length > defaultProjectCount ? (
                <div className="px-2">
                  <button
                    className="text-sm text-slate-500 transition hover:text-slate-900"
                    onClick={() => setShowAllProjects((current) => !current)}
                    type="button"
                  >
                    {showAllProjects ? 'Show less' : 'See more'}
                  </button>
                </div>
              ) : null}
            </div>

            {groupedItems.length > 0 ? (
              <ul className="space-y-1 border-t border-slate-200 pt-3">
                {groupedItems.map((item) => {
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isExpanded = expandedItems[item.title];
                  const isActive = router.asPath === item.href;

                  return (
                    <li key={item.title} className="flex flex-col">
                      <div className="flex items-center group">
                        <Link
                          href={item.href}
                          onClick={(e) => {
                            if (hasSubItems) {
                              e.preventDefault();
                              setExpandedItems((prev) => ({
                                ...prev,
                                [item.title]: !prev[item.title],
                              }));
                            } else {
                              toggleSidebar();
                            }
                          }}
                          className={`
                        flex items-center px-3 py-1.5 rounded-lg text-gray-900 dark:text-white
                        transition-colors justify-start flex-1 min-w-0
                        ${
                          isActive
                            ? 'bg-gray-100 dark:bg-gray-700 font-semibold'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }
                      `}
                        >
                          {renderItemIcon(item, true)}
                          <span className="ml-3 truncate text-[13px] leading-5">
                            {item.title}
                          </span>
                          {hasSubItems && (
                            <span className="ml-auto opacity-60">
                              {isExpanded ? (
                                <ChevronDown size={18} />
                              ) : (
                                <ChevronRight size={18} />
                              )}
                            </span>
                          )}
                        </Link>
                      </div>
                      {hasSubItems && isExpanded && (
                        <ul className="mt-1 space-y-1">
                          {item.subItems?.map((subItem: LeftNavBarProps) => {
                            const isSubActive = router.asPath === subItem.href;
                            return (
                              <li key={subItem.title}>
                                <Link
                                  href={subItem.href}
                                  onClick={() => toggleSidebar()}
                                  className={`
                                flex items-center px-3 py-1.5 rounded-lg transition-colors
                                ${
                                  isSubActive
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }
                              `}
                                >
                                  {renderItemIcon(subItem, true)}
                                  <span className="ml-3 min-w-0">
                                    <span
                                      className={`block truncate text-[13px] leading-5 ${
                                        isSubActive ? 'font-semibold' : ''
                                      }`}
                                    >
                                      {subItem.title}
                                    </span>
                                    <span className="block truncate text-[11px] leading-4 text-slate-500">
                                      {subItem.description}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </nav>
      </aside>
    </>
  );
};

const SidebarWithProjectsData = (props: SidebarProps) => {
  const { data: geckoProjects = [] } = useGetGeckoProjectsQuery();
  return <SidebarContent {...props} geckoProjects={geckoProjects} />;
};

export const Sidebar = (props: SidebarProps) => {
  return <SidebarWithProjectsData {...props} />;
};
