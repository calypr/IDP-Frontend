import whyDidYouRender from '@welldone-software/why-did-you-render';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  whyDidYouRender(React);
}
import App, { AppProps, AppContext, AppInitialProps } from 'next/app';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { MantineProvider } from '@mantine/core';
import mantinetheme from '../mantineTheme';

import '@xyflow/react/dist/style.css';
import 'react-complex-tree/lib/style-modern.css';
import {
  Gen3Provider,
  type ModalsConfig,
  RegisteredIcons,
  SessionConfiguration,
  registerExplorerDefaultCellRenderers,
  registerCohortBuilderDefaultPreviewRenderers,
  registerMetadataSchemaApp,
  registerCohortDiscoveryApp,
} from '@gen3/frontend';

import { registerDefaultRemoteSupport } from '@gen3/core';

import { registerCohortTableCustomCellRenderers } from '@/lib/CohortBuilder/CustomCellRenderers';
import { registerCustomExplorerDetailsPanels } from '@/lib/CohortBuilder/FileDetailsPanel';

import '../styles/globals.css';
import '@fontsource/montserrat';
import '@fontsource/source-sans-pro';
import '@fontsource/lato';

import { setDRSHostnames } from '@gen3/core';
import drsHostnames from '../../config/drsHostnames.json';
import { loadContent } from '@/lib/content/loadContent';
import Loading from '../components/Loading';

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactDOM = require('react-dom');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axe = require('@axe-core/react');
  axe(React, ReactDOM, 1000);
}


// TODO fix app registration

interface Gen3AppProps {
  icons: Array<RegisteredIcons>;
  modalsConfig: ModalsConfig;
  sessionConfig: SessionConfiguration;
}

const Gen3App = ({
  Component,
  pageProps,
  icons,
  sessionConfig,
  modalsConfig,
}: AppProps & Gen3AppProps) => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      setDRSHostnames(drsHostnames);
      registerDefaultRemoteSupport();
      registerMetadataSchemaApp();
      registerCohortDiscoveryApp();
      registerExplorerDefaultCellRenderers();
      registerCohortBuilderDefaultPreviewRenderers();
      registerCohortTableCustomCellRenderers();
      registerCustomExplorerDetailsPanels();
      isFirstRender.current = false;
      console.log('Gen3 App initialized');
    }
  }, []);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // Only on client-side
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAppsPortal = window.location.pathname.startsWith('/Apps');
      if (isAppsPortal) {
        document.body.classList.add('bg-gray-100');
      } else {
        document.body.classList.remove('bg-gray-100');
      }
    }
  }, []);
  return (
    <React.Fragment>
      <MantineProvider theme={mantinetheme}>
        {isClient ? (
          <Suspense fallback={<Loading />}>
            <Gen3Provider
              icons={icons}
              sessionConfig={sessionConfig}
              modalsConfig={modalsConfig}
            >
              <Component {...pageProps} />
            </Gen3Provider>
          </Suspense>
        ) : (
          // Show some fallback UI while waiting for the client to load
          <Loading />
        )}
      </MantineProvider>
    </React.Fragment>
  );
};

Gen3App.getInitialProps = async (
  context: AppContext,
): Promise<Gen3AppProps & AppInitialProps> => {
  const ctx = await App.getInitialProps(context);

  try {
    const res = await loadContent();
    return {
      ...ctx,
      ...res,
    };
  } catch (error: any) {
    console.error('Provider Wrapper error loading config', error.toString());
  }

  // Return default values in case of an error
  return {
    ...ctx,
    icons: [
      {
        prefix: 'gen3',
        lastModified: 0,
        icons: {},
        width: 0,
        height: 0,
      },
    ],
    modalsConfig: {},
    sessionConfig: {},
  };
};
export default Gen3App;
