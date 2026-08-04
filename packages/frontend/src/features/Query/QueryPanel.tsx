import dynamic from 'next/dynamic';
import React from 'react';
import { LoadingOverlay } from '@mantine/core';
import { ProtectedContent } from '../../components/Protected';
import type { QueryConfiguration } from './types';

// Wrapper function for displaying loading element before GqlQueryEditor renders
const GqlQueryEditor = dynamic(() => import('./GqlQueryEditor'), {
  loading: () => <LoadingOverlay visible={true} />,
  ssr: false,
});

interface QueryPanelProps {
  configuration: QueryConfiguration;
  title?: string;
}

const QueryPanel = ({ configuration }: QueryPanelProps) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return (
    <div className="h-full min-h-0 bg-slate-50 p-4 sm:p-5 lg:p-6">
      <ProtectedContent>
        <div className="h-full min-h-0 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.55)]">
          <GqlQueryEditor configuration={configuration} />
        </div>
      </ProtectedContent>
    </div>
  );
};

export default QueryPanel;
