import React, { ReactElement, useState } from 'react';
import { GraphiQL } from 'graphiql';
import type { Fetcher } from '@graphiql/toolkit';
import { Text, Select } from '@mantine/core';
import {
  GEN3_GUPPY_API,
  GEN3_GRIP_API,
  selectHeadersWithCSRFToken,
  useCoreSelector,
} from '@gen3/core';
import { GqlQueryEditorProps } from './types';

/**
 * Fetches graphql data from a graphql endpoint if one is specified, or guppy by default.
 * @param graphQLEndpoint - The location of the graphql endpoint.
 * @returns a component containing a GraphiQL editor
 */
const GqlQueryEditor = ({
  graphQLEndpoint,
}: GqlQueryEditorProps): ReactElement => {
  const [query, setQuery] = useState('');
  const headers = useCoreSelector(selectHeadersWithCSRFToken);
  const endpoints = {
    flatModel: `${GEN3_GUPPY_API}/graphql`, // Replace with actual endpoints
    graphModel: `${GEN3_GRIP_API}/graphql`,
  };
  const [selectedEndpoint, setSelectedEndpoint] = useState(endpoints.flatModel);

  const fetcher: Fetcher = async (graphQLParams) => {
    const response = await fetch(selectedEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(graphQLParams),
    });
    return response.json().catch(() => response.text());
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header Section with Database Selector */}
      <div className="flex justify-between items-center m-2">
        <Text size="xl" fw={500}>
          Query Graph
        </Text>
        <div className="flex items-center space-x-2">
          <Select
            id="db-select"
            value={selectedEndpoint}
            onChange={(value) => setSelectedEndpoint(value || '')}
            className="p-1 rounded"
            data={Object.entries(endpoints).map(([key, url]) => ({
              value: url,
              label: key,
            }))}
          />
        </div>
      </div>
      <GraphiQL
        fetcher={fetcher}
      />
    </div>
  );
};

export default GqlQueryEditor;
