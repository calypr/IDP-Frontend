import React, { useMemo, PropsWithChildren } from 'react';
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

  const { finalState, toggleButton } = useResponsiveSidebar(leftNavDisabled);

  const mainPadding = useMemo(() => {
    if (leftNavDisabled) return '';
    return finalState === 'open' ? 'pl-48' : 'pl-0';
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
      <div className="flex flex-1">
        {/* Sidebar */}
        {!leftNavDisabled && (
          <Sidebar items={headerProps.leftnav} state={finalState} />
        )}

        {/* Main Content */}
        <main
          className={`
            flex-1 overflow-hidden transition-all duration-300
            ${mainPadding}
          `}
          {...mainProps}
        >
          {children}
        </main>
      </div>

      {/* FOOTER */}
      {CustomFooterComponent ? (
        <CustomFooterComponent {...footerProps} />
      ) : (
        <Footer {...footerProps} basePage={leftNavDisabled} />
      )}
    </div>
  );
};

export default NavPageLayout;
