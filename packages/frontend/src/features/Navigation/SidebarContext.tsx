import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useRouter } from 'next/router';
import { SidebarState, LeftNavBarProps } from './types';

interface SidebarContextType {
  userOpened: boolean;
  setUserOpened: (opened: boolean) => void;
  buttonState: SidebarState;
  setButtonState: (state: SidebarState) => void;
  expandedItems: Record<string, boolean>;
  setExpandedItems: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  toggleSidebar: () => void;
  resizeState: SidebarState;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);
export const SIDEBAR_DESKTOP_QUERY = '(min-width: 1024px)';

export const getSidebarResizeState = (): SidebarState => {
  if (typeof window === 'undefined') return 'closed';

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(SIDEBAR_DESKTOP_QUERY).matches
      ? 'open'
      : 'closed';
  }

  return window.innerWidth >= 1024 ? 'open' : 'closed';
};

const isAppHomePath = (path?: string): boolean =>
  path === '/' || Boolean(path?.startsWith('/Apps'));

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({
  children,
  items,
}: {
  children: ReactNode;
  items?: LeftNavBarProps[];
}) => {
  const router = useRouter();
  const isAppsPath = isAppHomePath(router.asPath);
  const [userOpened, setUserOpened] = useState(false);
  const [buttonState, setButtonState] = useState<SidebarState>('closed');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {},
  );

  const [resizeState, setResizeState] = useState<SidebarState>('closed');
  const lastResizeState = useRef<SidebarState>('closed');

  useEffect(() => {
    setButtonState('closed');
    setUserOpened(false);
  }, [isAppsPath]);

  useEffect(() => {
    const handleViewportChange = (nextState: SidebarState) => {
      if (lastResizeState.current === nextState) return;

      lastResizeState.current = nextState;
      setResizeState(nextState);

      if (nextState === 'closed') {
        setButtonState('closed');
        setUserOpened(false);
      }
    };

    const updateViewportState = () =>
      handleViewportChange(getSidebarResizeState());

    updateViewportState();

    if (typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia(SIDEBAR_DESKTOP_QUERY);
      const handleMediaQueryChange = (event: MediaQueryListEvent) => {
        handleViewportChange(event.matches ? 'open' : 'closed');
      };

      mediaQuery.addEventListener?.('change', handleMediaQueryChange);
      mediaQuery.addListener?.(handleMediaQueryChange);

      return () => {
        mediaQuery.removeEventListener?.('change', handleMediaQueryChange);
        mediaQuery.removeListener?.(handleMediaQueryChange);
      };
    }

    window.addEventListener('resize', updateViewportState);
    return () => window.removeEventListener('resize', updateViewportState);
  }, []);

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

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};
