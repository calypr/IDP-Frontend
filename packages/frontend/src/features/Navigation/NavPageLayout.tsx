import React, {
  CSSProperties,
  PropsWithChildren,
  useEffect,
  useRef,
} from 'react';
import Head from 'next/head';
import Footer from './Footer/Footer';
import Header from './Header';
import { Sidebar, useResponsiveSidebar } from './Sidebar';
import { NavPageLayoutProps } from './types';
import { PageLoadBoundary } from '../../components/MessageCards';

const DEFAULT_HEADER_HEIGHT = '4rem';
const DEFAULT_FOOTER_HEIGHT = '0px';

type LayoutStyle = CSSProperties & {
  '--gen3-header-height': string;
  '--gen3-footer-height': string;
};

const useMeasuredLayoutParts = (
  rootRef: React.RefObject<HTMLDivElement | null>,
  headerRef: React.RefObject<HTMLDivElement | null>,
  footerRef: React.RefObject<HTMLDivElement | null>,
) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return undefined;

    const elements = [
      { ref: headerRef, variable: '--gen3-header-height' },
      { ref: footerRef, variable: '--gen3-footer-height' },
    ] as const;

    const updateSize = (element: HTMLDivElement, variable: string) => {
      root.style.setProperty(
        variable,
        `${element.getBoundingClientRect().height}px`,
      );
    };

    elements.forEach(({ ref, variable }) => {
      if (ref.current) updateSize(ref.current, variable);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        elements.forEach(({ ref, variable }) => {
          if (ref.current) updateSize(ref.current, variable);
        });
      });

      elements.forEach(({ ref }) => {
        if (ref.current) observer.observe(ref.current);
      });

      return () => observer.disconnect();
    }

    const handleResize = () => {
      elements.forEach(({ ref, variable }) => {
        if (ref.current) updateSize(ref.current, variable);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [footerRef, headerRef, rootRef]);
};

const NavPageLayout = ({
  headerProps,
  footerProps,
  mainProps,
  headerMetadata,
  CustomHeaderComponent,
  CustomFooterComponent,
  children,
  layoutMode = 'document',
  pageProblems,
}: PropsWithChildren<NavPageLayoutProps>) => {
  const leftNavDisabled = headerMetadata.title === 'CALYPR Landing Page';
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const { finalState, toggleButton } = useResponsiveSidebar(leftNavDisabled);
  const {
    className: mainClassName,
    style: mainStyle,
    ...resolvedMainProps
  } = mainProps ?? {};
  const isViewportLayout = layoutMode === 'viewport';

  useMeasuredLayoutParts(rootRef, headerRef, footerRef);

  const layoutStyle: LayoutStyle = {
    '--gen3-header-height': DEFAULT_HEADER_HEIGHT,
    '--gen3-footer-height': DEFAULT_FOOTER_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
    ...(isViewportLayout
      ? {
          height: '100dvh',
          overflow: 'hidden',
        }
      : {}),
  };

  return (
    <div
      ref={rootRef}
      className={`gen3-nav-page-layout gen3-nav-page-layout--${layoutMode}`}
      style={layoutStyle}
    >
      <Head>
        <title>{headerMetadata.title || 'App'}</title>
        {headerMetadata.content && (
          <meta
            property="og:title"
            content={headerMetadata.content}
            key={headerMetadata.key}
          />
        )}
      </Head>

      <div
        ref={headerRef}
        className="gen3-nav-page-layout__header"
        style={{ position: 'sticky', top: 0, zIndex: 50, flex: 'none' }}
      >
        {CustomHeaderComponent ? (
          <CustomHeaderComponent {...headerProps} />
        ) : (
          <Header
            {...headerProps}
            title={headerMetadata.title}
            onToggle={toggleButton}
            basePage={leftNavDisabled}
          />
        )}
      </div>

      <div
        className="gen3-nav-page-layout__body"
        style={{
          position: 'relative',
          display: 'flex',
          minWidth: 0,
          minHeight: isViewportLayout ? 0 : undefined,
          flex: '1 1 auto',
          overflow: isViewportLayout ? 'hidden' : undefined,
        }}
      >
        {!leftNavDisabled && (
          <Sidebar items={headerProps.leftnav} state={finalState} />
        )}

        <main
          className={`gen3-nav-page-layout__main transition-all duration-300 ${
            mainClassName ?? ''
          }`}
          style={{
            display: isViewportLayout ? 'flex' : undefined,
            flexDirection: isViewportLayout ? 'column' : undefined,
            minWidth: 0,
            minHeight: isViewportLayout ? 0 : undefined,
            flex: '1 1 auto',
            overflow: isViewportLayout ? 'hidden' : 'visible',
            ...mainStyle,
          }}
          {...resolvedMainProps}
        >
          <PageLoadBoundary problems={pageProblems}>{children}</PageLoadBoundary>
        </main>
      </div>

      <div
        ref={footerRef}
        className="gen3-nav-page-layout__footer"
        style={{ flex: 'none' }}
      >
        {CustomFooterComponent ? (
          <CustomFooterComponent {...footerProps} />
        ) : (
          <Footer {...footerProps} basePage={leftNavDisabled} />
        )}
      </div>
    </div>
  );
};

export default NavPageLayout;
