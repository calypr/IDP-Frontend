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
    <ProtectedContent> 
      <GqlQueryEditor graphQLEndpoint={graphQLEndpoint} />
    </ProtectedContent>
  );
};

export default QueryPanel;
