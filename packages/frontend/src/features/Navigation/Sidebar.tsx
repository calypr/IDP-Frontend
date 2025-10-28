import Image from 'next/image';
import React, { useEffect, useState, useCallback } from 'react';
import type { SidebarProps, SidebarState } from './types';
import type { UseResponsiveSidebarResult } from './types';

export function useResponsiveSidebar(
  leftNavDisabled: boolean,
): UseResponsiveSidebarResult {
  // Tracks if the user has manually opened the sidebar
  const [userOpened, setUserOpened] = useState(false);
  // Tracks the state from the button click, defaults to 'open'
  const [buttonState, setButtonState] = useState<SidebarState>('open');

  // Define the breakpoint for automatic closing
  const CLOSE_BREAKPOINT = 1024;

  // Determines the size-based state
  const getResizeState = useCallback((): SidebarState => {
    if (typeof window === 'undefined') return 'open';
    const width = window.innerWidth;
    // Sidebar closes automatically below the breakpoint
    return width < CLOSE_BREAKPOINT ? 'closed' : 'open';
  }, []);

  const [resizeState, setResizeState] = useState<SidebarState>(getResizeState);

  // --- Revised useEffect Logic ---
  useEffect(() => {
    const handleResize = () => {
      const newState = getResizeState();
      setResizeState(newState);
      if (newState === 'closed') {
        setButtonState('closed');
      } else {
        setButtonState('open');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    // Re-run whenever the user's intent (userOpened) changes
  }, [getResizeState]);

  const toggleButton = useCallback(() => {
    setButtonState((prev) => {
      const newState = prev === 'open' ? 'closed' : 'open';
      // Track the user's intention
      setUserOpened(newState === 'open');
      return newState;
    });
  }, []);

  // Determine the final visible state:
  const finalState: SidebarState = leftNavDisabled
    ? 'closed'
    : // 1. Force close if screen is small AND user hasn't opened it.
      resizeState === 'closed' && !userOpened
      ? 'closed'
      : // 2. Otherwise, respect the button's last state.
        buttonState;

  return { finalState, toggleButton };
}

export const Sidebar = ({ items, state }: SidebarProps) => {
  if (state === 'closed') return null;

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
      <nav className="flex flex-col flex-1 p-2">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.title} className="relative">
              <a
                href={item.href}
                className={`
                  flex items-center p-2 rounded-lg text-gray-900 dark:text-white
                  hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                  justify-start
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
                <span className="ml-3 text-sm truncate transition-opacity duration-200">
                  {item.title}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
