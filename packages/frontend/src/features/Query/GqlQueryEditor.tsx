import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { graphql } from 'cm6-graphql';
import { autocompletion } from '@codemirror/autocomplete';
import { Text, Select, Box, Center, Loader, Button, ScrollArea } from '@mantine/core';
import {
  GEN3_GUPPY_API,
  GEN3_GRIP_API,
  selectHeadersWithCSRFToken,
  useCoreSelector,
  useGetCSRFQuery,
} from '@gen3/core';
import Cookies from 'js-cookie';
import { GqlQueryEditorProps } from './types';
import { getIntrospectionQuery, buildClientSchema, GraphQLSchema } from 'graphql';

const guppyDefaultQuery = `query {
  document_reference {
    document_reference_id
  }
}`;

const gripDefaultQuery = `query {
  documentReference {
    id
  }
}`;

/**
 * Custom modern GraphQL Editor Component replacing GraphiQL.
 * Built using @uiw/react-codemirror and cm6-graphql.
 */
const GqlQueryEditor = ({
  graphQLEndpoint,
}: GqlQueryEditorProps) => {
  const { isLoading: isAuthLoading } = useGetCSRFQuery();
  const headers = useCoreSelector(selectHeadersWithCSRFToken);
  
  const endpoints = useMemo(() => ({
    flatModel: `${GEN3_GUPPY_API}/graphql`,
    graphModel: `${GEN3_GRIP_API}/graphql`,
    ...(graphQLEndpoint ? { custom: graphQLEndpoint } : {}),
  }), [graphQLEndpoint]);

  const [selectedEndpoint, setSelectedEndpoint] = useState(
    graphQLEndpoint || endpoints.flatModel
  );

  const [queryCode, setQueryCode] = useState(
    selectedEndpoint === endpoints.graphModel ? gripDefaultQuery : guppyDefaultQuery
  );
  const [responseJson, setResponseJson] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  
  const [schema, setSchema] = useState<GraphQLSchema | undefined>(undefined);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const headersRef = useRef(headers);
  headersRef.current = headers;

  // Swap default queries when endpoint changes
  useEffect(() => {
    if (selectedEndpoint === endpoints.graphModel) {
      setQueryCode(gripDefaultQuery);
    } else {
      setQueryCode(guppyDefaultQuery);
    }
  }, [selectedEndpoint, endpoints.graphModel]);

  // Fetch GraphQL schema for autocomplete
  useEffect(() => {
    let isMounted = true;
    
    const fetchSchema = async () => {
      setSchemaError(null);
      try {
        const token = Cookies.get('access_token') || Cookies.get('credentials_token') || Cookies.get('csrfToken');
        const finalHeaders = {
          ...headersRef.current,
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };

        const response = await fetch(selectedEndpoint, {
          method: 'POST',
          headers: finalHeaders as HeadersInit,
          credentials: 'include',
          body: JSON.stringify({ query: getIntrospectionQuery() })
        });

        if (!response.ok) {
           throw new Error(`Failed to load schema: ${response.status}`);
        }

        const result = await response.json();
        if (result?.data && isMounted) {
          const clientSchema = buildClientSchema(result.data);
          setSchema(clientSchema);
        }
      } catch (err: any) {
        if (isMounted) {
           console.error('Schema Introspection Error:', err);
           setSchemaError('Autocompletion disabled: Could not fetch schema');
           setSchema(undefined);
        }
      }
    };

    fetchSchema();

    return () => {
      isMounted = false;
    };
  }, [selectedEndpoint]);

  const handleQueryChange = useCallback((value: string) => {
    setQueryCode(value);
  }, []);

  const executeQuery = async () => {
    setIsFetching(true);
    setExecutionError(null);
    try {
      const token = Cookies.get('access_token') || Cookies.get('credentials_token') || Cookies.get('csrfToken');
      
      const finalHeaders = {
        ...headersRef.current,
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      const response = await fetch(selectedEndpoint, {
        method: 'POST',
        headers: finalHeaders as HeadersInit,
        credentials: 'include',
        body: JSON.stringify({ query: queryCode })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API ${response.status}: ${body.slice(0, 100)}`);
      }

      const result = await response.json();
      setResponseJson(JSON.stringify(result, null, 2));
    } catch (err: any) {
      console.error('GraphQL Fetch Error:', err);
      setExecutionError(err.message || String(err));
      setResponseJson('');
    } finally {
      setIsFetching(false);
    }
  };

  if (isAuthLoading && !headers['X-CSRF-Token']) {
    return (
      <Center className="h-64 w-full">
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <Box className="flex flex-col h-full w-full overflow-hidden" 
         style={{ minHeight: '800px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
      
      {/* Top Controls Bar */}
      <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <Text size="md" fw={700} color="dark" className="tracking-wide">QUERY EXPLORER</Text>
          <Button 
            onClick={executeQuery} 
            loading={isFetching}
            size="xs" 
            color="indigo"
          >
            Run Query
          </Button>
        </div>
        
        <div className="flex items-center space-x-3">
          {schemaError && <Text size="xs" color="orange" fw={500}>{schemaError}</Text>}
          {executionError && <Text size="xs" color="red" fw={500}>Error: {executionError}</Text>}
          <Select
            label=""
            placeholder="Select Database Model"
            value={selectedEndpoint}
            onChange={(value) => setSelectedEndpoint(value || '')}
            data={Object.entries(endpoints).map(([key, url]) => ({
              value: url,
              label: key === 'flatModel' ? 'Guppy (Flat Data)' : (key === 'graphModel' ? 'Grip (Graph Data)' : key),
            }))}
            style={{ width: '280px' }}
            size="xs"
          />
        </div>
      </div>

      {/* Editor / Response Split View */}
      <div className="flex-grow flex flex-row overflow-hidden relative">
        {/* Left Side: CodeMirror Input */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
           <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold flex justify-between">
              <span>GraphQL Query</span>
              {schema && <span className="text-green-600 font-normal">Schema Loaded (Autocomplete Active)</span>}
           </div>
           <ScrollArea className="flex-grow h-full" type="auto">
             <CodeMirror
               value={queryCode}
               minHeight="100%"
               extensions={[
                 schema ? graphql(schema) : graphql(),
                 autocompletion({ activateOnTyping: true, defaultKeymap: true })
               ]}
               onChange={handleQueryChange}
               theme="light"
               basicSetup={{
                 lineNumbers: true,
                 foldGutter: true,
                 highlightActiveLine: true,
                 bracketMatching: true,
                 autocompletion: true,
                 syntaxHighlighting: true,
               }}
               style={{ fontSize: '14px', height: '100%' }}
             />
           </ScrollArea>
        </div>

        {/* Right Side: Response View */}
        <div className="w-1/2 flex flex-col bg-gray-50">
           <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold flex justify-between">
              <span>Response Data</span>
              {isFetching && <Loader size="xs" color="gray" />}
           </div>
           
           <ScrollArea className="flex-grow h-full relative" type="auto">
             {!responseJson && !executionError && !isFetching && (
               <Center className="h-full w-full text-gray-400 absolute top-0 left-0" style={{ pointerEvents: 'none' }}>
                  Hit "Run Query" to fetch results.
               </Center>
             )}
             
             {responseJson && (
               <CodeMirror
                 value={responseJson}
                 minHeight="100%"
                 readOnly={true}
                 theme="light"
                 basicSetup={{
                   lineNumbers: true,
                   foldGutter: true,
                 }}
                 style={{ fontSize: '13px', height: '100%' }}
               />
             )}
           </ScrollArea>
        </div>
      </div>
    </Box>
  );
};

export default GqlQueryEditor;
