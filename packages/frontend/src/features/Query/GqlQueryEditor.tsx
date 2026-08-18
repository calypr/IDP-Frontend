import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { graphql } from 'cm6-graphql';
import { EditorView } from '@codemirror/view';
import {
  buildClientSchema,
  getIntrospectionQuery,
  GraphQLSchema,
  IntrospectionQuery,
  parse,
  print,
  validate,
} from 'graphql';
import { autocompletion } from '@codemirror/autocomplete';
import { useClipboard } from '@mantine/hooks';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  MultiSelect,
  Select,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconBook,
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconDatabase,
  IconPlayerPlay,
  IconSearch,
  IconX,
  IconBrush,
} from '@tabler/icons-react';
import {
  fetchGraphQL,
  selectHeadersWithCSRFToken,
  useCoreSelector,
  useGetCSRFQuery,
} from '@gen3/core';
import { applyProjectBinding, getModePreset } from './presets';
import { normalizeQueryConfiguration, parseVariables } from './config';
import { useQueryProjectSelector } from './project';
import type { GqlQueryEditorProps } from './types';

const STACK_DRAGGER_PX = 8;

const paneOuterScrollTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { minHeight: '100%' },
  '.cm-content': { paddingTop: '8px', paddingBottom: '8px' },
});

interface DocEntry {
  readonly name: string;
  readonly type: any;
  readonly description?: string;
}

const getBaseType = (type: any): any =>
  type?.ofType ? getBaseType(type.ofType) : type;

const schemaEntries = (
  schema: GraphQLSchema,
  root: 'query' | 'mutation',
): DocEntry[] => {
  const fields =
    root === 'query'
      ? schema.getQueryType()?.getFields()
      : schema.getMutationType()?.getFields();
  return Object.values(fields ?? {}).map((field) => ({
    name: field.name,
    type: getBaseType(field.type),
    description: field.description ?? undefined,
  }));
};

const GqlQueryEditor = ({ configuration }: GqlQueryEditorProps) => {
  const normalizedConfiguration = useMemo(
    () => normalizeQueryConfiguration(configuration),
    [configuration],
  );
  const { isLoading: isAuthLoading } = useGetCSRFQuery();
  const headers = useCoreSelector(selectHeadersWithCSRFToken);
  const projectSelector = useQueryProjectSelector();

  const defaultMode = normalizedConfiguration.defaultMode;
  const [selectedModeID, setSelectedModeID] = useState(defaultMode);
  const selectedMode =
    normalizedConfiguration.modes.find((mode) => mode.id === selectedModeID) ??
    normalizedConfiguration.modes[0];
  const selectedEndpoint = selectedMode
    ? normalizedConfiguration.endpoints[selectedMode.endpoint]
    : undefined;
  const preset = useMemo(
    () => (selectedMode ? getModePreset(selectedMode) : null),
    [selectedMode],
  );

  const [queryCode, setQueryCode] = useState(() => preset?.query ?? '');
  const [variablesJson, setVariablesJson] = useState(() =>
    JSON.stringify(preset?.variables ?? {}, null, 2),
  );
  const [responseJson, setResponseJson] = useState('');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schema, setSchema] = useState<GraphQLSchema>();
  const [isFetching, setIsFetching] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [docHistory, setDocHistory] = useState<DocEntry[]>([]);
  const [docsWidth, setDocsWidth] = useState(25);
  const [queryWidth, setQueryWidth] = useState(50);
  const [variablesHeight, setVariablesHeight] = useState(33);

  const containerRef = useRef<HTMLDivElement>(null);
  const queryStackRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<string | null>(null);
  const schemaRequestRef = useRef<AbortController | null>(null);
  const executionRequestRef = useRef<AbortController | null>(null);
  const executionIDRef = useRef(0);
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const sizingRef = useRef({ docsWidth, showDocs });
  sizingRef.current = { docsWidth, showDocs };
  const clipboard = useClipboard({ timeout: 2000 });

  const projectRequired = Boolean(preset && preset.binding !== 'none');
  const supportsMultipleProjects =
    preset?.binding === 'loom-project-filter' ||
    preset?.binding === 'guppy-auth-resource-path';
  const projectError = projectSelector.isUnavailable
    ? 'One or more selected projects are not in the accessible Gecko project list'
    : projectRequired &&
        !projectSelector.isLoading &&
        projectSelector.selectedProjectIDs.length === 0
      ? 'Select a project before running this mode'
      : null;

  useEffect(() => {
    if (
      !normalizedConfiguration.modes.some((mode) => mode.id === selectedModeID)
    ) {
      setSelectedModeID(defaultMode);
    }
  }, [defaultMode, normalizedConfiguration.modes, selectedModeID]);

  useEffect(() => {
    if (!preset) return;
    setDocHistory([]);
    setSchema(undefined);
    setSchemaError(null);
    setExecutionError(null);
    setResponseJson('');
    setQueryCode(preset.query);
    setVariablesJson(JSON.stringify(preset.variables, null, 2));
  }, [preset]);

  const selectedProjectKey = projectSelector.selectedProjectIDs.join('\0');
  useEffect(() => {
    if (!preset) return;
    setVariablesJson((currentVariables) => {
      try {
        return JSON.stringify(
          applyProjectBinding(
            parseVariables(currentVariables),
            preset.binding,
            projectSelector.selectedProjectIDs,
          ),
          null,
          2,
        );
      } catch {
        return currentVariables;
      }
    });
  }, [preset, projectSelector.selectedProjectIDs, selectedProjectKey]);

  useEffect(() => {
    schemaRequestRef.current?.abort();
    const controller = new AbortController();
    schemaRequestRef.current = controller;
    if (!selectedEndpoint || !preset) return () => controller.abort();

    const loadSchema = async () => {
      setSchema(undefined);
      setSchemaError(null);
      try {
        const result = await fetchGraphQL<IntrospectionQuery>(
          { query: getIntrospectionQuery() },
          {
            endpoint: selectedEndpoint.url,
            headers: headersRef.current,
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        const clientSchema = buildClientSchema(result);
        setSchema(clientSchema);
        if (preset.schemaField) {
          const fields =
            preset.schemaRoot === 'query'
              ? clientSchema.getQueryType()?.getFields()
              : clientSchema.getMutationType()?.getFields();
          if (!fields?.[preset.schemaField]) {
            setSchemaError(
              `This endpoint does not expose ${preset.schemaField}; update the selected service or schema`,
            );
          }
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setSchemaError(
            `Autocompletion unavailable: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    };
    void loadSchema();
    return () => controller.abort();
  }, [preset, selectedEndpoint]);

  const handleMouseDown = (pane: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    resizingRef.current = pane;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const container = containerRef.current;
    if (!container || !resizingRef.current) return;
    const rect = container.getBoundingClientRect();
    if (resizingRef.current === 'docsWidth') {
      setDocsWidth(
        Math.max(
          12,
          Math.min(45, ((event.clientX - rect.left) / rect.width) * 100),
        ),
      );
    } else if (resizingRef.current === 'queryWidth') {
      const leftOffset = sizingRef.current.showDocs
        ? (sizingRef.current.docsWidth * rect.width) / 100
        : 0;
      const available = rect.width - leftOffset;
      setQueryWidth(
        Math.max(
          25,
          Math.min(
            75,
            ((event.clientX - rect.left - leftOffset) / available) * 100,
          ),
        ),
      );
    } else if (resizingRef.current === 'variablesHeight') {
      const queryStackRect =
        queryStackRef.current?.getBoundingClientRect() ?? rect;
      const queryHeight =
        ((event.clientY - queryStackRect.top) / queryStackRect.height) * 100;
      setVariablesHeight(100 - Math.max(1, Math.min(99, queryHeight)));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  useEffect(
    () => () => {
      schemaRequestRef.current?.abort();
      executionRequestRef.current?.abort();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    },
    [handleMouseMove, handleMouseUp],
  );

  const executeQuery = async () => {
    if (!selectedEndpoint || !preset || projectError) return;
    let variables: Record<string, unknown>;
    try {
      variables = parseVariables(variablesJson);
    } catch (error: unknown) {
      setExecutionError(
        `Invalid variables JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
      setResponseJson('');
      return;
    }
    if (preset.schemaField === 'dataframeRows') {
      const input = variables.input;
      const selector =
        input && typeof input === 'object' && !Array.isArray(input)
          ? (input as Record<string, unknown>).selector
          : undefined;
      const completeSelector =
        selector &&
        typeof selector === 'object' &&
        !Array.isArray(selector) &&
        ['recipe', 'translationVersion', 'output'].every(
          (field) =>
            typeof (selector as Record<string, unknown>)[field] === 'string' &&
            ((selector as Record<string, unknown>)[field] as string).trim(),
        );
      if (!completeSelector) {
        setExecutionError(
          'Loom dataframe requests require input.selector.recipe, input.selector.translationVersion, and input.selector.output from the published Explorer recipe.',
        );
        setResponseJson('');
        return;
      }
    }
    let document;
    try {
      document = parse(queryCode.trim());
      if (schema) {
        const validationErrors = validate(schema, document);
        if (validationErrors.length) {
          setExecutionError(
            validationErrors.map((error) => error.message).join('; '),
          );
          return;
        }
      }
    } catch (error: unknown) {
      setExecutionError(
        `Invalid GraphQL: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    executionRequestRef.current?.abort();
    const controller = new AbortController();
    executionRequestRef.current = controller;
    const executionID = ++executionIDRef.current;
    const boundVariables = applyProjectBinding(
      variables,
      preset.binding,
      projectSelector.selectedProjectIDs,
    );
    setVariablesJson(JSON.stringify(boundVariables, null, 2));
    setExecutionError(null);
    setIsFetching(true);
    try {
      const result = await fetchGraphQL<Record<string, unknown>>(
        { query: print(document), variables: boundVariables },
        {
          endpoint: selectedEndpoint.url,
          headers: headersRef.current,
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted || executionID !== executionIDRef.current)
        return;
      setResponseJson(JSON.stringify({ data: result }, null, 2));
    } catch (error: unknown) {
      if (controller.signal.aborted || executionID !== executionIDRef.current)
        return;
      const requestError = error as {
        data?: unknown;
        status?: number | string;
        code?: string;
        requestId?: string;
      };
      const detail = error instanceof Error ? error.message : String(error);
      setExecutionError(
        `${requestError.status ?? 'API'}${requestError.code ? ` ${requestError.code}` : ''}${requestError.requestId ? ` request ${requestError.requestId}` : ''}: ${detail}`,
      );
      setResponseJson(
        JSON.stringify(
          requestError.data ?? { errors: [{ message: detail }] },
          null,
          2,
        ),
      );
    } finally {
      if (executionID === executionIDRef.current) setIsFetching(false);
    }
  };

  const prettifyCode = () => {
    try {
      setQueryCode(print(parse(queryCode.trim())));
      setVariablesJson(JSON.stringify(parseVariables(variablesJson), null, 2));
    } catch (error: unknown) {
      setExecutionError(error instanceof Error ? error.message : String(error));
    }
  };

  const queryExtensions = useMemo(
    () => [
      paneOuterScrollTheme,
      schema ? graphql(schema) : graphql(),
      autocompletion(),
    ],
    [schema],
  );
  const variablesExtensions = useMemo(() => [paneOuterScrollTheme], []);
  const responseExtensions = useMemo(() => [paneOuterScrollTheme], []);
  const centerPanelWidth = showDocs
    ? `calc((100% - ${docsWidth}%) * ${queryWidth / 100})`
    : `${queryWidth}%`;
  const variableHeight = Math.max(1, Math.min(99, variablesHeight));
  const queryHeight = 100 - variableHeight;
  if (isAuthLoading && !headers['X-CSRF-Token']) {
    return (
      <Center className="h-full w-full">
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <Box
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-2 border-slate-300 bg-white shadow-sm"
      style={{ borderRadius: '8px' }}
    >
      <div
        data-testid="query-toolbar"
        className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 bg-gradient-to-r from-white via-white to-blue-50 px-5 py-3"
      >
        <div className="flex items-center gap-2">
          <Badge color="primary.0" variant="light" size="sm" radius="sm">
            GraphQL
          </Badge>
          <Text size="sm" fw={700} c="dark.8">
            Query Explorer
          </Text>
          <Divider orientation="vertical" className="mx-1" />
          <Tooltip label={projectError ?? 'Execute Query (Shift+Enter)'}>
            <Button
              onClick={executeQuery}
              loading={isFetching}
              disabled={Boolean(projectError) || !queryCode.trim()}
              size="xs"
              color="primary.0"
              leftSection={<IconPlayerPlay size={14} />}
            >
              Run
            </Button>
          </Tooltip>
          <ActionIcon
            onClick={prettifyCode}
            variant="outline"
            color="accent.0"
            size="sm"
            aria-label="Prettify query"
          >
            <IconBrush size={16} />
          </ActionIcon>
          <ActionIcon
            onClick={() => setShowDocs((value) => !value)}
            variant={showDocs ? 'filled' : 'outline'}
            color="accent.0"
            size="sm"
            aria-label="Toggle schema documentation"
          >
            <IconBook size={16} />
          </ActionIcon>
        </div>
        {projectRequired && (
          <div className="min-w-64 max-w-2xl flex-1 px-4">
            <MultiSelect
              aria-label="Projects"
              placeholder={
                projectSelector.isLoading
                  ? 'Loading projects...'
                  : supportsMultipleProjects
                    ? 'Filter by projects'
                    : 'Select project'
              }
              value={[...projectSelector.selectedProjectIDs]}
              onChange={projectSelector.setSelectedProjectIDs}
              data={[...projectSelector.projectIDs]}
              searchable
              clearable
              maxValues={supportsMultipleProjects ? undefined : 1}
              size="xs"
              error={projectSelector.isUnavailable ? 'Unavailable' : undefined}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {schemaError && (
            <Text size="xs" c="orange.7" fw={500}>
              {schemaError}
            </Text>
          )}
          {executionError && (
            <Text size="xs" c="red.7" fw={500} maw={420}>
              Error: {executionError}
            </Text>
          )}
          <Select
            aria-label="Query mode"
            value={selectedModeID}
            onChange={(value) => value && setSelectedModeID(value)}
            data={normalizedConfiguration.modes.map((mode) => ({
              value: mode.id,
              label: mode.label,
            }))}
            size="xs"
            leftSection={<IconDatabase size={14} />}
            style={{ width: '220px' }}
          />
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 flex-row overflow-hidden"
      >
        {showDocs && (
          <>
            <div
              className="flex min-h-0 flex-col overflow-hidden border-r-2 border-slate-300 bg-gray-50"
              style={{ width: `${docsWidth}%` }}
            >
              <div className="flex items-center justify-between border-b-2 border-slate-200 bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700">
                <span>SCHEMA DOCUMENTATION</span>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={() => setShowDocs(false)}
                >
                  <IconX size={14} />
                </ActionIcon>
              </div>
              <div className="border-b border-gray-200 p-2">
                <Select
                  placeholder="Jump to type..."
                  searchable
                  size="xs"
                  data={
                    schema
                      ? Object.keys(schema.getTypeMap()).filter(
                          (type) => !type.startsWith('__'),
                        )
                      : []
                  }
                  onChange={(value) => {
                    const type = value && schema?.getType(value);
                    if (type)
                      setDocHistory([{ name: value, type: getBaseType(type) }]);
                  }}
                  leftSection={<IconSearch size={12} />}
                />
              </div>
              <ScrollArea className="flex-grow">
                {!schema ? (
                  <Center className="h-full">
                    <Loader size="xs" />
                  </Center>
                ) : (
                  <div className="p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-1">
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        onClick={() => setDocHistory([])}
                      >
                        Schema
                      </Button>
                      {docHistory.map((entry, index) => (
                        <React.Fragment key={`${entry.name}-${index}`}>
                          <IconChevronRight
                            size={10}
                            className="text-gray-400"
                          />
                          <Button
                            variant="subtle"
                            size="compact-xs"
                            onClick={() =>
                              setDocHistory(docHistory.slice(0, index + 1))
                            }
                          >
                            {entry.name}
                          </Button>
                        </React.Fragment>
                      ))}
                    </div>
                    {docHistory.length === 0 ? (
                      <div className="space-y-1">
                        {[
                          ...schemaEntries(schema, 'query'),
                          ...schemaEntries(schema, 'mutation'),
                        ].map((field) => (
                          <div
                            key={field.name}
                            className="group flex cursor-pointer items-center justify-between border-b border-gray-100 p-1.5 text-xs hover:bg-primary-lightest"
                            onClick={() => setDocHistory([field])}
                          >
                            <span className="font-mono text-blue-800">
                              {field.name}
                            </span>
                            <IconChevronRight
                              size={12}
                              className="text-gray-300"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <Text
                          size="xs"
                          fw={700}
                          c="blue.7"
                          className="mb-2 uppercase"
                        >
                          {docHistory[docHistory.length - 1].name}
                        </Text>
                        {docHistory[docHistory.length - 1].description && (
                          <Text size="xs" c="dimmed" className="mb-4 italic">
                            {docHistory[docHistory.length - 1].description}
                          </Text>
                        )}
                        <Divider
                          label="Fields"
                          labelPosition="center"
                          className="my-3"
                        />
                        {docHistory[docHistory.length - 1].type.getFields ? (
                          Object.values(
                            docHistory[docHistory.length - 1].type.getFields(),
                          ).map((field: any) => (
                            <div
                              key={field.name}
                              className="flex min-w-0 flex-col border-b border-gray-100 py-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="break-all font-mono text-xs font-bold text-indigo-900">
                                  {field.name}
                                </span>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  className="shrink-0"
                                >
                                  {field.type.toString()}
                                </Badge>
                              </div>
                              {field.description && (
                                <div className="mt-1 text-xs text-gray-500">
                                  {field.description}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <Text size="xs" c="dimmed">
                            This type has no fields.
                          </Text>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
            <div
              className="z-10 w-1.5 cursor-col-resize bg-slate-300 hover:bg-primary"
              onMouseDown={handleMouseDown('docsWidth')}
            />
          </>
        )}

        <div
          ref={queryStackRef}
          className="grid min-h-0 min-w-0 overflow-hidden bg-white"
          style={{
            width: centerPanelWidth,
            gridTemplateRows: `${queryHeight}% ${STACK_DRAGGER_PX}px ${variableHeight}%`,
          }}
        >
          <div
            data-testid="graphql-query-pane"
            className="flex min-h-0 flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-600">
              <span>GraphQL Query</span>
              {schema && (
                <span className="font-normal text-green-600">
                  Schema Loaded
                </span>
              )}
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overflow-x-auto"
              style={{ scrollbarGutter: 'stable' }}
            >
              <CodeMirror
                value={queryCode}
                extensions={queryExtensions}
                onChange={setQueryCode}
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
          <div
            className="z-10 cursor-row-resize bg-slate-300 hover:bg-primary"
            onMouseDown={handleMouseDown('variablesHeight')}
          />
          <div
            data-testid="query-variables-pane"
            className="flex min-h-0 flex-col overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-600">
              <span>Query Variables (Filters)</span>
              <Tooltip label="Copy Variables">
                <ActionIcon
                  onClick={() => clipboard.copy(variablesJson)}
                  size="xs"
                  variant="transparent"
                  color={clipboard.copied ? 'green' : 'gray'}
                >
                  {clipboard.copied ? (
                    <IconCheck size={12} />
                  ) : (
                    <IconCopy size={12} />
                  )}
                </ActionIcon>
              </Tooltip>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overflow-x-auto"
              style={{ scrollbarGutter: 'stable' }}
            >
              <CodeMirror
                value={variablesJson}
                extensions={variablesExtensions}
                onChange={setVariablesJson}
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
        </div>
        <div
          className="z-10 w-1.5 cursor-col-resize bg-slate-300 hover:bg-primary"
          onMouseDown={handleMouseDown('queryWidth')}
        />
        <div
          data-testid="response-data-pane"
          className="flex min-h-0 min-w-0 flex-grow flex-col overflow-hidden bg-white"
        >
          <div className="flex items-center justify-between border-b-2 border-slate-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-600">
            <span>Response Data</span>
            <Group gap="xs">
              {isFetching && <Loader size="xs" color="gray" />}
              <Tooltip label="Copy Response">
                <ActionIcon
                  onClick={() => clipboard.copy(responseJson)}
                  size="xs"
                  variant="transparent"
                  color={clipboard.copied ? 'green' : 'gray'}
                >
                  {clipboard.copied ? (
                    <IconCheck size={12} />
                  ) : (
                    <IconCopy size={12} />
                  )}
                </ActionIcon>
              </Tooltip>
            </Group>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {!responseJson && !executionError && !isFetching && (
              <Center className="absolute left-0 top-0 z-10 h-full w-full pointer-events-none text-gray-400">
                Hit &quot;Run&quot; to fetch results.
              </Center>
            )}
            <div
              className="min-h-0 flex-1 overflow-y-auto overflow-x-auto"
              style={{ scrollbarGutter: 'stable' }}
            >
              <CodeMirror
                value={responseJson}
                extensions={responseExtensions}
                readOnly
                theme="light"
                basicSetup={{ lineNumbers: true, foldGutter: true }}
                style={{ fontSize: '13px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </Box>
  );
};

export default GqlQueryEditor;
