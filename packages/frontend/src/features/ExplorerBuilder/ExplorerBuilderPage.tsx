import React from 'react';
import type { ComponentProps } from 'react';
import dynamic from 'next/dynamic';
import type { ExplorerBuilderClient } from './ExplorerBuilderClient';
import { isExplorerBuilderEnabled } from './availability';

export type ExplorerBuilderPageProps = ComponentProps<
  typeof ExplorerBuilderClient
>;

const Builder = dynamic<ExplorerBuilderPageProps>(
  () =>
    import('./ExplorerBuilderClient').then(
      (module) => module.ExplorerBuilderClient,
    ),
  { ssr: false },
);

export const ExplorerBuilderPage = (props: ExplorerBuilderPageProps) =>
  isExplorerBuilderEnabled() ? <Builder {...props} /> : null;

export default ExplorerBuilderPage;
