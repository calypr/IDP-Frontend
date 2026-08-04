import React from 'react';
import {
  useCoreSelector,
  selectGen3AppByName,
  GEN3_COMMONS_NAME,
} from '@gen3/core';
import { NextRouter, useRouter } from 'next/dist/client/router';
import { z } from 'zod';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

import {
  NavPageLayout,
  NavPageLayoutProps,
} from '@gen3/frontend';

interface AppConfig extends NavPageLayoutProps {
  configuration?: Record<string, any> | null;
}

const AppsPage = ({
  headerProps,
  footerProps,
  configuration,
  pageProblems,
}: AppConfig) => {
  const router = useRouter();
  const appName = getAppName(router);

  const GdcApp = useCoreSelector(
    () => selectGen3AppByName(appName), // TODO update ById to ByName
  ) as React.ElementType;

  if (!GdcApp)
    return (
      <div className="text-utility-warning font-bold m-10 border-base-darkest">
        App not found
      </div>
    );

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 App Page',
        content: 'App Data',
        key: 'gen3-app-page',
        ...(configuration?.headerMetadata ? configuration.headerMetadata : {}),
      }}
    >
      {GdcApp && <GdcApp {...configuration} />}
    </NavPageLayout>
  );
};

const getAppName = (router: NextRouter): string => {
  const { appName } = router.query;
  if (typeof appName === 'string') return appName;
  else if (typeof appName === 'object') return appName[0];

  return 'UNKNOWN_APP_ID';
};

export const getServerSideProps = defineSamplePageLoader(
  'DynamicApp',
  async (context) => {
    const appName = context.next.query.appName as string;
    return {
      configuration: await context.config.load({
        id: `app.${appName}`,
        source: 'content',
        resolvePath: () => `${GEN3_COMMONS_NAME}/apps/${appName}.json`,
        schema: z.object({}).passthrough(),
      }),
    };
  },
);

export default AppsPage;
