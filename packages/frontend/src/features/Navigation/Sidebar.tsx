import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useSidebarContext } from './SidebarContext';
import type { SidebarProps, SidebarState } from './types';
import type { UseResponsiveSidebarResult } from './types';

export function useResponsiveSidebar(
  leftNavDisabled: boolean,
): UseResponsiveSidebarResult {
  const {
    userOpened,
    buttonState,
    toggleSidebar,
    resizeState,
  } = useSidebarContext();

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


import { useRouter } from 'next/router';
import {
  useGetAuthzMappingsQuery,
  userHasMethodForServiceOnResource,
  resourcePathFromProjectID,
} from '@gen3/core';

export const Sidebar = ({ items, state }: SidebarProps) => {
  const router = useRouter();
  const { expandedItems, setExpandedItems } = useSidebarContext();

  // Keep menu expanded if navigating to a sub-item
  useEffect(() => {
    items.forEach((item) => {
      if (item.subItems?.some((sub) => router.asPath === sub.href)) {
        setExpandedItems((prev) => ({ ...prev, [item.title]: true }));
      }
    });
  }, [router.asPath, items, setExpandedItems]);
  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();

  if (state === 'closed') return null;



  const hasAccess = (perms: string | undefined) => {
    if (!perms) return true;
    return userHasMethodForServiceOnResource(
      'read',
      '*',
      resourcePathFromProjectID(perms),
      authzMapping,
    );
  };

  // Filter items and subItems based on permissions
  const visibleItems = items
    .filter((item) => hasAccess(item.perms) && item.title.toLowerCase() !== 'home')
    .map((item) => ({
      ...item,
      subItems: item.subItems?.filter((sub) => hasAccess(sub.perms)),
    }));

  return (
    <aside
      className={`
        fixed top-16 bottom-0 left-0
        w-48 flex flex-col bg-white dark:bg-gray-800
        border-r border-gray-200 dark:border-gray-700
        transition-all duration-300 ease-in-out shadow-xl overflow-hidden
        z-0
      `}
    >
      <nav className="flex flex-col flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedItems[item.title];
            const isExplorers = item.title.toLowerCase() === 'explorers';
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
                      }
                    }}
                    className={`
                      flex items-center p-2 rounded-lg text-gray-900 dark:text-white
                      transition-colors justify-start flex-1 min-w-0
                      ${
                        isActive
                          ? 'bg-gray-100 dark:bg-gray-700 font-semibold'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }
                    `}
                  >
                    <span className="shrink-0 w-6 h-6 relative">
                      <Image
                        src={item.icon}
                        alt={item.title}
                        fill
                        className="object-contain dark:invert"
                      />
                    </span>
                    <span className="ml-3 text-sm truncate">
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
                    {item.subItems?.map((subItem) => {
                      const isSubActive = router.asPath === subItem.href;
                      return (
                        <li key={subItem.title}>
                          <Link
                            href={subItem.href}
                            className={`
                              flex items-center p-2 rounded-lg transition-colors
                              text-sm
                              ${
                                isSubActive
                                  ? 'bg-gray-100 dark:bg-gray-700 font-semibold text-gray-900 dark:text-white'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }
                            `}
                          >
                            <span className="shrink-0 w-6 h-6 relative">
                              <Image
                                src={subItem.icon}
                                alt={subItem.title}
                                fill
                                className="object-contain dark:invert"
                              />
                            </span>
                            <span className="ml-3 truncate">{subItem.title}</span>
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
      </nav>
    </aside>
  );
};
