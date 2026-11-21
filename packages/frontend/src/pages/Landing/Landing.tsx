import React from 'react';

// if we want to use MDX
// import LandingPageMDX from "../../content/landing.mdx"
import LandingPageContent from '../../components/Content/LandingPageContent';
import NavPageLayout from '../../features/Navigation/NavPageLayout';
import type { LandingPageProps } from './types';

const LandingPage = ({ headerProps, footerProps, pageProblems, configuration }: LandingPageProps) => {
  return (
    <NavPageLayout
      {...{ footerProps, headerProps, pageProblems }}
      headerMetadata={{
        title: 'Gen3 Home Page',
        content: 'Home page',
        key: 'gen3-home-page',
        ...(configuration?.landing?.headerMetadata
          ? configuration.landing.headerMetadata
          : {}),
      }}
    >
      <div className="flex justify-items-center w-full">
        {configuration?.landing && (
          <LandingPageContent content={configuration.landing} />
        )}
      </div>
    </NavPageLayout>
  );
};

export default LandingPage;
