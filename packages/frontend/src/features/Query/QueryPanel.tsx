import dynamic from 'next/dynamic';
import React from 'react';
import { LoadingOverlay } from '@mantine/core';
import { ProtectedContent } from '../../components/Protected';

// Wrapper function for displaying loading element before GqlQueryEditor renders
const GqlQueryEditor = dynamic(() => import('./GqlQueryEditor'), {
  loading: () => <LoadingOverlay visible={true} />,
  ssr: false,
});

interface QueryPanelProps {
  graphQLEndpoint?: string;
  title?: string;
}

const QueryPanel = ({
  graphQLEndpoint,
}: QueryPanelProps) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return (
    <div className="h-full min-h-0 bg-base-max p-3 sm:p-4">
      <ProtectedContent>
        <div className="h-full min-h-0 rounded-2xl border border-slate-200/70 bg-white/75 p-1.5 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.55)] backdrop-blur-sm">
          <GqlQueryEditor graphQLEndpoint={graphQLEndpoint} />
        </div>
      </ProtectedContent>
    </div>
  );
};

export default QueryPanel;
