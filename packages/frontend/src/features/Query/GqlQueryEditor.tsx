import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { graphql } from 'cm6-graphql';
import { EditorView } from '@codemirror/view';
import { getIntrospectionQuery, buildClientSchema, GraphQLSchema, parse, print } from 'graphql';
import { autocompletion } from '@codemirror/autocomplete';
import { useClipboard } from '@mantine/hooks';
import { Text, Select, Box, Center, Loader, Button, ScrollArea, ActionIcon, Tooltip, Group, Divider, Badge } from '@mantine/core';
import {
  IconPlayerPlay,
  IconBrush,
  IconCopy,
  IconBook,
  IconDatabase,
  IconCheck,
  IconX,
  IconSearch,
  IconChevronRight,
  IconChevronDown,
} from '@tabler/icons-react';
import {
  GEN3_GUPPY_API,
  GEN3_GRIP_API,
  selectHeadersWithCSRFToken,
  useCoreSelector,
  useGetCSRFQuery,
} from '@gen3/core';
import Cookies from 'js-cookie';
import { GqlQueryEditorProps } from './types';

const guppyDefaultQuery = `query($filter: JSON) {
  document_reference(filter: $filter, first: 10) {
    document_reference_id
    project_id
  }
}`;

const guppyDefaultVariables = `{
  "filter": {
    "and": [
      {
        "=": {
          "auth_resource_path": "/programs/cbds/projects/git_drs_test"
        }
      }
    ]
  }
}`;

const gripDefaultQuery = `query($filter: JSON) {
  documentReference(filter: $filter, first: 10) {
    id
    auth_resource_path
  }
}`;

const gripDefaultVariables = `{
  "filter": {
    "=": {
      "DocumentReference.auth_resource_path":
        "/programs/cbds/projects/git_drs_test"
    }
  }
}`;

const STACK_DRAGGER_PX = 8;
const EDITOR_WORKSPACE_HEIGHT = 'calc(100vh - 10rem)';
const MIN_CODEMIRROR_LINE_HEIGHT_PX = 18;
const MAX_VISIBLE_FILL_LINES = 300;
const paneOuterScrollTheme = EditorView.theme({
  '&': { minHeight: '100%' },
  '.cm-editor': { minHeight: '100%' },
  '.cm-scroller': {
    overflow: 'visible',
  },
  '.cm-content': { minHeight: '100%' },
  '.cm-gutters': { minHeight: '100%' },
});

const getLineCount = (value: string): number => value.split('\n').length;

const padToLineCount = (value: string, minLines: number): string => {
  const current = getLineCount(value);
  if (current >= minLines) return value;
  return `${value}${'\n'.repeat(minLines - current)}`;
};

const trimTrailingNewlines = (value: string, maxToTrim: number): string => {
  let output = value;
  let trimmed = 0;
  while (trimmed < maxToTrim && output.endsWith('\n')) {
    output = output.slice(0, -1);
    trimmed += 1;
  }
  return output;
};

const calculateVisibleLines = (node: HTMLElement | null): number => {
  if (!node) return 1;
  const sampleLine = node.querySelector('.cm-line') as HTMLElement | null;
  const measuredLineHeight =
    sampleLine?.getBoundingClientRect().height ||
    Number.parseFloat(window.getComputedStyle(node).lineHeight) ||
    24;
  const lineHeight = Math.max(MIN_CODEMIRROR_LINE_HEIGHT_PX, measuredLineHeight);
  return Math.max(
    1,
    Math.min(MAX_VISIBLE_FILL_LINES, Math.ceil(node.clientHeight / lineHeight))
  );
};

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

  const [variablesJson, setVariablesJson] = useState(
    selectedEndpoint === endpoints.graphModel ? gripDefaultVariables : guppyDefaultVariables
  );

  const clipboard = useClipboard({ timeout: 2000 });
  const [showDocs, setShowDocs] = useState(false);
  const [docHistory, setDocHistory] = useState<any[]>([]); // To track breadcrumbs/navigation

  // Pane sizing states (percentages)
  const [docsWidth, setDocsWidth] = useState(25);
  // Center panel width as a percentage of remaining width after docs panel.
  const [queryWidth, setQueryWidth] = useState(50);
  // Vertical split in the right pane.
  const [variablesHeight, setVariablesHeight] = useState(33);

  // Resizing Refs
  const isResizingRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const queryEditorHostRef = useRef<HTMLDivElement>(null);
  const variablesEditorHostRef = useRef<HTMLDivElement>(null);
  const responseEditorHostRef = useRef<HTMLDivElement>(null);
  const [queryVisibleLines, setQueryVisibleLines] = useState(1);
  const [variablesVisibleLines, setVariablesVisibleLines] = useState(1);
  const [responseVisibleLines, setResponseVisibleLines] = useState(1);

  const headersRef = useRef(headers);
  headersRef.current = headers;

  const sizingRef = useRef({ docsWidth, queryWidth, showDocs });
  useEffect(() => {
    sizingRef.current = { docsWidth, queryWidth, showDocs };
  }, [docsWidth, queryWidth, showDocs]);

  const getBaseType = (type: any): any => {
    if (type.ofType) {
      return getBaseType(type.ofType);
    }
    return type;
  };

  const handleMouseDown = (pane: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = pane;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = pane.includes('Width') ? 'col-resize' : 'row-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const { docsWidth: dW, showDocs: sD } = sizingRef.current;
    
    if (isResizingRef.current === 'docsWidth') {
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setDocsWidth(Math.max(12, Math.min(45, newWidth)));
    } else if (isResizingRef.current === 'queryWidth') {
      const leftOffset = sD ? (dW * containerRect.width) / 100 : 0;
      const availableWidth = containerRect.width - leftOffset;
      if (availableWidth <= 0) return;
      const newWidth = ((e.clientX - containerRect.left - leftOffset) / availableWidth) * 100;
      setQueryWidth(Math.max(25, Math.min(75, newWidth)));
    } else if (isResizingRef.current === 'variablesHeight') {
      const rightRect = rightPanelRef.current?.getBoundingClientRect() ?? containerRect;
      const newHeight = ((e.clientY - rightRect.top) / rightRect.height) * 100;
      setVariablesHeight(Math.max(1, Math.min(99, newHeight)));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = 'default';
    };
  }, [handleMouseMove, handleMouseUp]);

  const updateVisibleLineCounts = useCallback(() => {
    setQueryVisibleLines((previous) => {
      const next = calculateVisibleLines(queryEditorHostRef.current);
      return previous === next ? previous : next;
    });
    setVariablesVisibleLines((previous) => {
      const next = calculateVisibleLines(variablesEditorHostRef.current);
      return previous === next ? previous : next;
    });
    setResponseVisibleLines((previous) => {
      const next = calculateVisibleLines(responseEditorHostRef.current);
      return previous === next ? previous : next;
    });
  }, []);

  useEffect(() => {
    updateVisibleLineCounts();
    const queryNode = queryEditorHostRef.current;
    const variablesNode = variablesEditorHostRef.current;
    const responseNode = responseEditorHostRef.current;
    if (!queryNode || !variablesNode || !responseNode) return;

    const observer = new ResizeObserver(() => {
      updateVisibleLineCounts();
    });
    observer.observe(queryNode);
    observer.observe(variablesNode);
    observer.observe(responseNode);
    return () => observer.disconnect();
  }, [updateVisibleLineCounts]);

  // Swap default queries and variables and reset docs when endpoint changes
  useEffect(() => {
    setDocHistory([]); // Reset documentation history when switching endpoints
    setSchema(undefined); // Clear old schema to show loading state
    if (selectedEndpoint === endpoints.graphModel) {
      setQueryCode(gripDefaultQuery);
      setVariablesJson(gripDefaultVariables);
    } else {
      setQueryCode(guppyDefaultQuery);
      setVariablesJson(guppyDefaultVariables);
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
      } catch (err: unknown) {
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

      let variables = {};
      try {
        variables = JSON.parse(variablesJson);
        // Pretty print variables on execute
        setVariablesJson(JSON.stringify(variables, null, 2));
      } catch {
        console.warn('Invalid variables JSON');
      }

      const response = await fetch(selectedEndpoint, {
        method: 'POST',
        headers: finalHeaders as HeadersInit,
        credentials: 'include',
        body: JSON.stringify({ 
          query: queryCode,
          variables: variables
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API ${response.status}: ${body.slice(0, 100)}`);
      }

      const result = await response.json();
      setResponseJson(JSON.stringify(result, null, 2));
    } catch (err: unknown) {
      console.error('GraphQL Fetch Error:', err);
      setExecutionError(err instanceof Error ? err.message : String(err));
      setResponseJson('');
    } finally {
      setIsFetching(false);
    }
  };

  const prettifyCode = () => {
    try {
      setQueryCode(print(parse(queryCode)));
      const parsedVars = JSON.parse(variablesJson);
      setVariablesJson(JSON.stringify(parsedVars, null, 2));
    } catch (err) {
      console.error('Prettify error:', err);
    }
  };


  if (isAuthLoading && !headers['X-CSRF-Token']) {
    return (
      <Center className="h-64 w-full">
        <Loader size="md" />
      </Center>
    );
  }

  const centerPanelWidth = showDocs
    ? `calc((100% - ${docsWidth}%) * ${queryWidth / 100})`
    : `${queryWidth}%`;
  const clampedVariablesHeight = Math.max(1, Math.min(99, variablesHeight));
  const clampedResponseHeight = 100 - clampedVariablesHeight;
  const queryFillerLines = Math.max(0, queryVisibleLines - getLineCount(queryCode));
  const variablesFillerLines = Math.max(
    0,
    variablesVisibleLines - getLineCount(variablesJson)
  );
  const paddedQueryCode = padToLineCount(queryCode, queryVisibleLines);
  const paddedVariablesJson = padToLineCount(variablesJson, variablesVisibleLines);
  const paddedResponseJson = padToLineCount(responseJson, responseVisibleLines);

  return (
    <Box
      className="flex min-h-0 w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-sm"
      style={{
        borderRadius: '4px',
        height: EDITOR_WORKSPACE_HEIGHT,
      }}
    >
      
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-white via-white to-blue-50 px-4 py-2">
        <div className="flex items-center space-x-2">
          <Badge color="primary.0" variant="light" size="sm" radius="sm" className="mr-2">
            GraphQL
          </Badge>
          <Text size="sm" fw={700} c="dark.8">
            Query Explorer
          </Text>
          
          <Divider orientation="vertical" className="mx-2" />

          <Group gap="xs">
            <Tooltip label="Execute Query (Shift+Enter)">
              <Button 
                onClick={executeQuery} 
                loading={isFetching}
                size="xs" 
                color="primary.0"
                leftSection={<IconPlayerPlay size={14} />}
              >
                Run
              </Button>
            </Tooltip>

            <Tooltip label="Prettify Query & Variables">
              <ActionIcon onClick={prettifyCode} variant="outline" color="accent.0" size="sm">
                <IconBrush size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Toggle Schema Documentation">
              <ActionIcon onClick={() => setShowDocs(!showDocs)} variant={showDocs ? "filled" : "outline"} color="accent.0" size="sm">
                <IconBook size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </div>
        
        <div className="flex items-center space-x-3">
          {schemaError && <Text size="xs" c="orange.7" fw={500}>{schemaError}</Text>}
          {executionError && <Text size="xs" c="red.7" fw={500}>Error: {executionError}</Text>}
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
            leftSection={<IconDatabase size={14} />}
          />
        </div>
      </div>

      {/* Main View Area */}
      <div
        ref={containerRef}
        className={`relative flex min-h-0 flex-grow flex-row overflow-hidden ${isResizingRef.current ? 'select-none' : ''}`}
      >
        
        {/* Left Side: Documentation Explorer */}
        {showDocs && (
          <>
            <div 
              className="slide-in-left flex flex-col overflow-hidden border-r border-gray-200 bg-gray-50"
              style={{ width: `${docsWidth}%` }}
            >
              <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs text-gray-700 font-bold flex justify-between items-center">
                <span>SCHEMA DOCUMENTATION</span>
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setShowDocs(false)}><IconX size={14}/></ActionIcon>
              </div>
              
              <div className="p-2 border-b border-gray-200">
                 <Select
                    placeholder="Jump to type..."
                    searchable
                    size="xs"
                    data={schema ? Object.keys(schema.getTypeMap()).filter(t => !t.startsWith('__')) : []}
                    onChange={(val) => {
                      if (val && schema) {
                        const type = schema.getType(val);
                        if (type) setDocHistory([{ name: val, type: getBaseType(type) }]);
                      }
                    }}
                    leftSection={<IconSearch size={12} />}
                 />
              </div>

              <ScrollArea className="flex-grow">
                {!schema ? (
                  <Center className="h-full"><Loader size="xs" /></Center>
                ) : (
                  <div className="p-3">
                    {/* Navigation / Breadcrumbs */}
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                      <Button 
                        variant="subtle" 
                        size="compact-xs" 
                        color="primary.0"
                        onClick={() => setDocHistory([])}
                        className="px-1"
                      >
                        Schema
                      </Button>
                      {docHistory.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <IconChevronRight size={10} className="text-gray-400" />
                          <Button 
                            variant="subtle" 
                            size="compact-xs" 
                            color={idx === docHistory.length - 1 ? "gray" : "accent.0"}
                            onClick={() => setDocHistory(docHistory.slice(0, idx + 1))}
                            className="px-1"
                          >
                            {item.name}
                          </Button>
                        </React.Fragment>
                      ))}
                    </div>

                    {docHistory.length === 0 ? (
                      <div>
                        <Text size="xs" fw={700} c="primary.0" className="uppercase mb-2 flex items-center gap-1">
                          <IconChevronDown size={12} /> Query Root
                        </Text>
                        <div className="space-y-1">
                          {Object.values(schema.getQueryType()?.getFields() || {}).map(field => (
                            <div 
                              key={field.name} 
                              onClick={() => {
                                const baseType = getBaseType(field.type);
                                setDocHistory([{ name: field.name, type: baseType, title: field.name }]);
                              }}
                              className="group flex cursor-pointer items-center justify-between border-b border-gray-100 p-1.5 text-xs last:border-0 hover:bg-primary-lightest"
                            >
                              <span className="font-mono text-blue-800">{field.name}</span>
                              <IconChevronRight size={12} className="text-gray-300 group-hover:text-primary" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                          <Text size="xs" fw={700} c="blue.7" className="mb-2 uppercase">
                            {docHistory[docHistory.length - 1].name}
                          </Text>
                          {docHistory[docHistory.length - 1].type.description && (
                            <Text size="xs" color="dimmed" className="mb-4 italic">
                              {docHistory[docHistory.length - 1].type.description}
                            </Text>
                          )}

                          <Divider label="Fields" labelPosition="center" className="my-3" />
                          
                          <div className="divide-y divide-gray-100">
                             {docHistory[docHistory.length - 1].type.getFields ? (
                               Object.values(docHistory[docHistory.length - 1].type.getFields()).map((f: any) => (
                                 <div key={f.name} className="py-2.5 flex flex-col min-w-0">
                                    <div className="flex items-start justify-between gap-2 min-w-0">
                                      <span className="font-mono text-xs font-bold text-indigo-900 break-all overflow-hidden min-w-0">
                                        {f.name}
                                      </span>
                                      <Badge 
                                        size="xs" 
                                        variant="light" 
                                        color="accent.0 "
                                        radius="xs" 
                                        className="cursor-pointer shrink-0 mt-0.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const baseType = getBaseType(f.type);
                                          setDocHistory([...docHistory, { name: baseType.name, type: baseType }]);
                                        }}
                                      >
                                        {f.type.toString()}
                                      </Badge>
                                    </div>
                                    {f.description && (
                                      <div className="mt-1 text-xs text-gray-500 leading-snug break-words">
                                        {f.description}
                                      </div>
                                    )}
                                    {f.args?.length > 0 && (
                                      <div className="mt-2 rounded-r-sm border-l-2 border-blue-100 bg-gray-50/50 py-1.5 pl-2">
                                         <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-blue-400">Arguments</div>
                                         {f.args.map((a: any) => (
                                           <div key={a.name} className="text-[10px] text-gray-600 font-mono flex gap-1 flex-wrap">
                                              <span className="text-orange-700 font-semibold">{a.name}</span>: 
                                              <span className="text-gray-400">{a.type.toString()}</span>
                                           </div>
                                         ))}
                                      </div>
                                    )}
                                 </div>
                               ))
                             ) : (
                               <Text size="xs" color="dimmed">This type has no fields (Scalar/Enum).</Text>
                             )}
                          </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
            {/* Dragger 1 */}
            <div 
              className="w-1 bg-gray-200 hover:bg-primary cursor-col-resize z-10 transition-colors"
              onMouseDown={handleMouseDown('docsWidth')}
            />
          </>
        )}

        {/* Middle: CodeMirror Input */}
        <div 
          className="flex min-w-0 flex-col border-r border-gray-200 bg-white"
          style={{ width: centerPanelWidth }}
        >
           <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold flex justify-between">
              <span>GraphQL Query</span>
              {schema && <span className="font-normal text-green-600">Schema Loaded</span>}
           </div>
           <div
             ref={queryEditorHostRef}
             className="min-h-0 flex-1 overflow-y-scroll overflow-x-auto bg-white"
             style={{ scrollbarGutter: 'stable' }}
           >
             <CodeMirror
               value={paddedQueryCode}
               extensions={[
                 paneOuterScrollTheme,
                 schema ? graphql(schema) : graphql(),
                 autocompletion({ activateOnTyping: true, defaultKeymap: true })
               ]}
               onChange={(val) => setQueryCode(trimTrailingNewlines(val, queryFillerLines))}
               theme="light"
               basicSetup={{
                 lineNumbers: true,
                 foldGutter: true,
                 highlightActiveLine: true,
                 bracketMatching: true,
                 autocompletion: true,
                 syntaxHighlighting: true,
               }}
               style={{ fontSize: '14px' }}
             />
           </div>
        </div>

        {/* Dragger 2 */}
        <div 
          className="w-1 bg-gray-200 hover:bg-primary cursor-col-resize z-10 transition-colors"
          onMouseDown={handleMouseDown('queryWidth')}
        />

        {/* Right Side Stack: Variables & Response */}
        <div
          ref={rightPanelRef}
          className="grid min-h-0 min-w-0 flex-grow overflow-hidden bg-gray-50"
          style={{
            gridTemplateRows: `${clampedVariablesHeight}% ${STACK_DRAGGER_PX}px ${clampedResponseHeight}%`,
          }}
        >
           {/* Section 1: Variables / Filters Editor */}
           <div
              className="flex min-h-0 flex-col overflow-hidden border-b border-gray-200"
            >
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold flex justify-between">
                  <span>Query Variables (Filters)</span>
                  <Tooltip label="Copy Variables">
                    <ActionIcon onClick={() => clipboard.copy(variablesJson)} size="xs" variant="transparent" color={clipboard.copied ? "green" : "gray"}>
                      {clipboard.copied ? <IconCheck size={12}/> : <IconCopy size={12}/>}
                    </ActionIcon>
                  </Tooltip>
              </div>
              <div
                ref={variablesEditorHostRef}
                className="min-h-0 flex-1 overflow-y-scroll overflow-x-auto"
                style={{ scrollbarGutter: 'stable' }}
              >
                <CodeMirror
                  value={paddedVariablesJson}
                  extensions={[paneOuterScrollTheme]}
                  onChange={(val) =>
                    setVariablesJson(trimTrailingNewlines(val, variablesFillerLines))
                  }
                  theme="light"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    syntaxHighlighting: true,
                  }}
                  style={{ fontSize: '13px' }}
                />
              </div>
           </div>

           {/* Vertical Dragger */}
           <div 
              className="bg-gray-200 hover:bg-primary cursor-row-resize z-10 transition-colors"
              onMouseDown={handleMouseDown('variablesHeight')}
           />

           {/* Section 2: Response View */}
           <div
              className="flex min-h-0 flex-col overflow-hidden bg-white"
            >
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold flex justify-between">
                  <span>Response Data</span>
                  <Group gap="xs">
                    {isFetching && <Loader size="xs" color="gray" />}
                    <Tooltip label="Copy Response">
                      <ActionIcon onClick={() => clipboard.copy(responseJson)} size="xs" variant="transparent" color={clipboard.copied ? "green" : "gray"}>
                        {clipboard.copied ? <IconCheck size={12}/> : <IconCopy size={12}/>}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
              </div>
              
              <div className="relative flex min-h-0 flex-1 flex-col">
                {!responseJson && !executionError && !isFetching && (
                  <Center className="h-full w-full text-gray-400 absolute top-0 left-0 z-10 pointer-events-none">
                      Hit &quot;Run&quot; to fetch results.
                  </Center>
                )}

                <div
                  ref={responseEditorHostRef}
                  className="min-h-0 flex-1 overflow-y-scroll overflow-x-auto"
                  style={{ scrollbarGutter: 'stable' }}
                >
                  <CodeMirror
                    value={paddedResponseJson}
                    extensions={[paneOuterScrollTheme]}
                    readOnly={true}
                    theme="light"
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                    }}
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>
           </div>
        </div>
      </div>
    </Box>
  );
};

export default GqlQueryEditor;
