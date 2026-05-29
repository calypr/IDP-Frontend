import React, { useMemo, PropsWithChildren, useRef } from 'react';
import Head from 'next/head';
import Footer from './Footer/Footer';
import Header from './Header';
import { Sidebar, useResponsiveSidebar } from './Sidebar';
import { NavPageLayoutProps } from './types';

const NavPageLayout = ({
  headerProps,
  footerProps,
  mainProps,
  headerMetadata,
  CustomHeaderComponent,
  CustomFooterComponent,
  children,
}: PropsWithChildren<NavPageLayoutProps>) => {
  const leftNavDisabled = headerMetadata.title === 'CALYPR Landing Page';
  const footerRef = useRef<HTMLDivElement>(null);

  const { finalState, toggleButton } = useResponsiveSidebar(leftNavDisabled);
  const { className: mainClassName, ...resolvedMainProps } = mainProps ?? {};

  const mainPadding = useMemo(() => {
    const paddingTop = 'pt-16'; // For 64px header height
    let paddingBottom = 'pb-20'; // Fallback for ~80px footer height
    if (footerRef.current) {
      paddingBottom = `pb-[${footerRef.current.offsetHeight}px]`; // Dynamic footer height
    }
    const padding = `${paddingTop} ${paddingBottom}`;
    if (leftNavDisabled) return padding;
    return finalState === 'open' ? `${padding} pl-48` : `${padding} pl-0`;
  }, [finalState, leftNavDisabled]);

  return (
    <div className="flex flex-col min-h-screen">
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

      {/* HEADER */}
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

      {/* BODY */}
      <div className="flex flex-1 relative">
        {/* Sidebar */}
        {!leftNavDisabled && (
          <Sidebar items={headerProps.leftnav} state={finalState} />
        )}

        {/* Main Content */}
        <main
          className={`
            flex-1 overflow-hidden transition-all duration-300
            ${mainPadding}
            ${mainClassName ?? ''}
          `}
          {...resolvedMainProps}
        >
          {children}
        </main>
      </div>

      {/* FOOTER */}
      <div ref={footerRef}>
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
