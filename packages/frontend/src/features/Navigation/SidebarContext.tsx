import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { SidebarState, LeftNavBarProps } from './types';

interface SidebarContextType {
  userOpened: boolean;
  setUserOpened: (opened: boolean) => void;
  buttonState: SidebarState;
  setButtonState: (state: SidebarState) => void;
  expandedItems: Record<string, boolean>;
  setExpandedItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleSidebar: () => void;
  resizeState: SidebarState;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children, items }: { children: ReactNode; items?: LeftNavBarProps[] }) => {
  const router = useRouter();
  const isAppsPath = router.asPath.startsWith('/Apps');
  const [userOpened, setUserOpened] = useState(false);
  const [buttonState, setButtonState] = useState<SidebarState>(
    isAppsPath ? 'open' : 'closed',
  );
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const CLOSE_BREAKPOINT = 1024;

  const getResizeState = useCallback((): SidebarState => {
    if (typeof window === 'undefined') return 'open';
    const width = window.innerWidth;
    return width < CLOSE_BREAKPOINT ? 'closed' : 'open';
  }, []);

  const [resizeState, setResizeState] = useState<SidebarState>(getResizeState);

  useEffect(() => {
    setButtonState(isAppsPath ? 'open' : 'closed');
    setUserOpened(false);
  }, [isAppsPath]);

  useEffect(() => {
    const handleResize = () => {
      setResizeState(getResizeState());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResizeState]);

  // Keep menu expanded if navigating to a sub-item (automatic behavior)
  useEffect(() => {
    if (!items) return;
    items.forEach((item) => {
      if (item.subItems?.some((sub) => router.asPath === sub.href)) {
        setExpandedItems((prev) => ({ ...prev, [item.title]: true }));
      }
    });
  }, [router.asPath, items]);

  const toggleSidebar = useCallback(() => {
    setButtonState((prev) => {
      const newState = prev === 'open' ? 'closed' : 'open';
      setUserOpened(newState === 'open');
      return newState;
    });
  }, []);

  const value = {
    userOpened,
    setUserOpened,
    buttonState,
    setButtonState,
    expandedItems,
    setExpandedItems,
    toggleSidebar,
    resizeState,
  };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};
