import React from 'react';
import { definePageLoader } from '../../lib/pageLoader';
import { GEN3_COMMONS_NAME } from '@gen3/core';

import NavPageLayout from '../../features/Navigation/NavPageLayout';
import ResourcePageContent from '../../components/Content/ResourcePageContent';
import type { ResourcePageConfig } from '../../components/Content/ResourcePageContent';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { ResourceConfigurationSchema } from './configurationSchema';
import type { ResourcePageProps } from './types';

const ResourcePage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
}: ResourcePageProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems }}
      headerMetadata={{
        title: 'Gen3 Resource Page',
        content: 'Resource Page',
        key: 'gen3-resource-page',
      }}
    >
      <div className="flex flex-row  justify-items-center">
        <div className="sm:prose-base lg:prose-lg xl:prose-xl 2xl:prose-xl mx-20">
          {configuration && <ResourcePageContent {...configuration} />}
        </div>
      </div>
    </NavPageLayout>
  );
};

// should move this thing into _app.tsx and make a dedicated layout component after https://github.com/vercel/next.js/discussions/10949 is addressed
const resourceConfiguration = {
  id: 'resource',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/resource.json`,
  schema: ResourceConfigurationSchema,
};

export const getServerSideProps = definePageLoader<ResourcePageProps>({
  name: 'Resource',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: (await context.config.load(resourceConfiguration)) as unknown as ResourcePageConfig,
  }),
  fallback: () => ({ configuration: null }),
});

export default ResourcePage;
