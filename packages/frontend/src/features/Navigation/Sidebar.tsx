import Image from 'next/image';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SidebarProps, SidebarState } from './types';
import { UseResponsiveSidebarResult } from './types';

export function useResponsiveSidebar(
  leftNavDisabled: boolean,
): UseResponsiveSidebarResult {
  const [buttonState, setButtonState] = useState<'expanded' | 'collapsed'>(
    'expanded',
  );
  const [userOpened, setUserOpened] = useState(false);
  const prevResizeState = useRef<SidebarState>('expanded'); // Track previous

  const getResizeState = useCallback(() => {
    if (typeof window === 'undefined') return 'expanded';
    const width = window.innerWidth;
    if (width < 1024) return 'closed';
    if (width < 1280) return 'collapsed';
    return 'expanded';
  }, []);

  const [resizeState, setResizeState] = useState<SidebarState>(getResizeState);

  useEffect(() => {
    const handleResize = () => {
      const newState = getResizeState();
      const oldState = prevResizeState.current;

      setResizeState(newState);

      // Only reset userOpened when ENTERING 'closed' from another state
      if (newState === 'closed' && oldState !== 'closed') {
        setUserOpened(false);
        setButtonState('expanded');
      }
      // Entering 'collapsed' or 'expanded' — preserve user state
      else if (newState === 'collapsed' && oldState === 'closed') {
        // Just left closed — keep userOpened if they opened it
      }
      // Entering expanded — always full
      else if (newState === 'expanded') {
        setButtonState('expanded');
      }
      prevResizeState.current = newState;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResizeState]);

  const toggleButton = useCallback(() => {
    if (resizeState === 'closed') {
      // ALLOW OPEN FROM CLOSED
      setUserOpened(true);
      setButtonState('collapsed');
    } else {
      // NORMAL TOGGLE
      setButtonState((prev) =>
        prev === 'expanded' ? 'collapsed' : 'expanded',
      );
    }
  }, [resizeState]);

  const finalState: SidebarState = leftNavDisabled
    ? 'closed'
    : resizeState === 'closed' && !userOpened
      ? 'closed'
      : buttonState === 'expanded'
        ? 'expanded'
        : 'collapsed';

  return { buttonState, resizeState, finalState, toggleButton };
}

export const Sidebar = ({ items, state }: SidebarProps) => {
  if (state === 'closed') return null;

  const widthClass = state === 'expanded' ? 'w-48' : 'w-16';
  const showText = state === 'expanded';
  return (
    <aside
      className={`
        flex flex-col bg-white dark:bg-gray-800
        border-r border-gray-200 dark:border-gray-700
        transition-all duration-300 ease-in-out shadow-xl overflow-hidden
        ${widthClass}
      `}
    >
      <nav className="flex flex-col flex-1 p-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const iconOnly = state === 'collapsed';
            return (
              <li key={item.title} className="relative group">
                <a
                  href={item.href}
                  className={`
                    flex items-center p-2 rounded-lg text-gray-900 dark:text-white
                    hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                    ${iconOnly ? 'justify-center' : 'justify-start'}
                  `}
                >
                  <span className="shrink-0 w-6 h-6 relative">
                    <Image
                      src={item.icon}
                      alt={item.title}
                      fill
                      className="object-contain"
                    />
                  </span>

                  {showText && (
                    <span className="ml-3 text-sm truncate transition-opacity duration-200">
                      {item.title}
                    </span>
                  )}
                </a>

                {iconOnly && (
                  <span
                    className="
                      absolute left-full ml-2 top-1/2 -translate-y-1/2
                      px-2 py-1 bg-gray-800 text-white text-xs rounded
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      pointer-events-none whitespace-nowrap z-50
                    "
                  >
                    {item.title}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
