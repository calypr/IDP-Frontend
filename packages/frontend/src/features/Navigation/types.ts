import { ReactElement, ComponentType } from 'react';
import { TopBarProps } from './TopBar/TopBar';
import { BannerProps } from './Banner';
import { StylingOverrideWithMergeControl } from '../../types';
import { FooterProps } from './Footer/types';

export interface NavigationButtonProps {
  icon: string;
  tooltip: string;
  href: string;
  noBasePath?: boolean;
  name: string;
  iconHeight?: string;
  classNames?: StylingOverrideWithMergeControl;
}

export interface NavigationBarLogo {
  readonly src: string;
  readonly title?: string;
  readonly description: string;
  readonly width?: number;
  readonly height?: number;
  readonly noBasePath?: boolean;
  readonly divider?: boolean;
  readonly basePath?: string;
  readonly classNames?: StylingOverrideWithMergeControl;
  readonly href: string;
  onToggle: () => void;
  basepage?: boolean;
}

export interface NavigationProps {
  readonly logo?: NavigationBarLogo;
  readonly items?: NavigationButtonProps[];
  readonly title?: string;
  readonly loginIcon?: ReactElement | string;
  readonly classNames?: StylingOverrideWithMergeControl;
}

export interface LeftNavBarProps {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly href: string;
  readonly perms: string;
  readonly subItems?: ReadonlyArray<LeftNavBarProps>;
}

export interface HeaderToggleProps extends HeaderProps {
  onToggle: () => void;
}
export interface HeaderMetadata {
  title: string;
  content: string;
  key: string;
}

/**
 * Type guard to check if an object is of type HeaderMetadata
 * @param obj - The object to check
 * @returns True if the object is a valid HeaderMetadata
 */
export const isHeaderMetadata = (obj: unknown): obj is HeaderMetadata => {
  // Check if obj is a non-null object
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Check all required properties exist and are non-empty strings
  return (
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.content === 'string' &&
    candidate.content.trim().length > 0 &&
    typeof candidate.key === 'string' &&
    candidate.key.trim().length > 0
  );
};

/**
 * Sitewide props that can be passed to Pages
 */
interface CommonsData {
  contactEmail?: string;
}

export interface HeaderProps {
  children?: React.ReactNode; // Add this line
  topBar: TopBarProps;
  navigation: NavigationProps;
  banners?: Array<BannerProps>;
  type?: 'horizontal' | 'vertical' | 'original';
  leftnav: Array<LeftNavBarProps>;
  basePage: boolean;
  readonly siteProps?: CommonsData;
}

export interface MainContentProps {
  fixed: boolean;
}

export interface NameAndIcon {
  readonly name?: string;
  readonly iconSize?: string;
  readonly rightIcon?: string;
  readonly leftIcon?: string;
  readonly classNames?: StylingOverrideWithMergeControl;
}

export interface SidebarProps {
  items: LeftNavBarProps[];
  state: SidebarState;
}

export type SidebarState = 'open' | 'closed';

export interface UseResponsiveSidebarResult {
  finalState: SidebarState;
  toggleButton: () => void;
}

export interface NavPageLayoutProps {
  headerProps: HeaderProps;
  footerProps: FooterProps;
  mainProps?: Partial<MainContentProps & { fixed?: boolean }>;
  headerMetadata: HeaderMetadata & {
    title?: string;
    content?: string;
    key?: string;
  };
  CustomHeaderComponent?: ComponentType<HeaderProps>;
  CustomFooterComponent?: ComponentType<FooterProps>;
}
