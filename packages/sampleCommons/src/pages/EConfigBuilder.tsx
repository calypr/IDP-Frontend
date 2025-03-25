import React, { useState, useMemo, useEffect } from 'react';
import { getAutocompleteSuggestions } from 'graphql-language-service-interface';
import { IPosition } from 'graphql-language-service-types';
import {
  buildClientSchema,
  IntrospectionQuery,
  getIntrospectionQuery,
  type GraphQLSchema,
} from 'graphql';
import {
  Center,
  Box,
  Button,
  UnstyledButton,
  TextInput,
  Autocomplete,
  Text,
  Loader,
  Modal,
  Group,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  NavPageLayout,
  NavPageLayoutProps,
  getNavPageLayoutPropsFromConfig,
  type SummaryTable,
  type TabsConfig,
  type CohortPanelConfig,
  type SummaryChart,
  type SummaryTableColumn,
} from '@gen3/frontend';
import {
  useGeneralGQLQuery,
  type FacetDefinition,
  FacetType,
  GEN3_API,
} from '@gen3/core';
import { GetServerSideProps } from 'next';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';

const GraphQLAutocomplete = ({
  value,
  onChange,
  placeholder,
  schema,
  context,
  tabType,
}: {
  value: string;
  onChange: ((value: string) => void) | undefined;
  placeholder: string | undefined;
  schema: GraphQLSchema;
  context: string | undefined;
  tabType: string | undefined;
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let queryText: string;
    let cursorPosition: IPosition;
    if (context === 'tabType') {
      queryText = `query { ${value}`;
      cursorPosition = { line: 1, character: 8 + value.length } as IPosition;
    } else if (context === 'fieldName' && tabType) {
      queryText = `query { ${tabType} { ${value}`;
      cursorPosition = {
        line: 1,
        character: 11 + tabType.length + value.length,
      } as IPosition;
    } else {
      setSuggestions([]);
      return;
    }

    try {
      const rawSuggestions = getAutocompleteSuggestions(
        schema,
        queryText,
        cursorPosition,
      );
      const processedSuggestions = Array.isArray(rawSuggestions)
        ? rawSuggestions
            .map((s) => s.label)
            .filter((s) => s && !s.startsWith('__') && !s.startsWith('_'))
        : [];
      setSuggestions(processedSuggestions);
    } catch (error) {
      console.error('Error generating autocomplete suggestions:', error);
      setSuggestions([]);
    }
  }, [value, schema, context, tabType]);

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data={suggestions}
      color="secondary.0"
    />
  );
};

const useGetSchemaQuery = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: getIntrospectionQuery(),
  });

  const cachedSchemaData = useMemo(() => {
    if (data) {
      try {
        return buildClientSchema(data.data as IntrospectionQuery);
      } catch (error) {
        console.error('Error building client schema:', error);
        return [];
      }
    }
    return [];
  }, [data]);
  return { sdata: cachedSchemaData, sisLoading: isLoading, sisError: isError };
};

type TableItem = {
  id: number;
  field: string;
  label: string;
};

type ChartItem = {
  id: number;
  field: string;
  title: string;
  chartType: string;
};

type ColumnProps<T extends 'table' | 'filters' | 'charts'> = {
  columnId: string;
  items: (TableItem | ChartItem)[];
  removeData: (tabId: string | number, entryId: number) => void;
  tabId: string | number;
  type: T;
};

const Column = <T extends 'table' | 'filters' | 'charts'>({
  columnId,
  items,
  removeData,
  tabId,
  type,
}: ColumnProps<T>) => {
  const validItems = Array.isArray(items)
    ? items.filter(
        (item): item is T extends 'charts' ? ChartItem : TableItem =>
          item != null,
      )
    : [];

  const renderEntry = (entry: T extends 'charts' ? ChartItem : TableItem) => {
    if (type === 'charts') {
      const chartEntry = entry as ChartItem; // Type assertion for clarity
      return `${chartEntry.title}\n${chartEntry.field}\n${chartEntry.chartType}`;
    } else {
      const tableEntry = entry as TableItem; // Type assertion for clarity
      return `${tableEntry.label}\n${tableEntry.field}`;
    }
  };

  return (
    <Droppable droppableId={`${tabId}-${columnId}`}>
      {(provided) => (
        <Box
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="flex-1 min-w-[150px]"
        >
          {validItems.map((entry, index) => (
            <Draggable
              key={entry.id.toString()}
              draggableId={entry.id.toString()}
              index={index}
            >
              {(provided) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  className="flex items-center p-2 bg-white border border-gray-200 rounded-lg shadow-sm mb-2 mx-1 min-w-[140px]"
                >
                  <Box className="flex-grow bg-gray-100 p-2 rounded-md whitespace-pre-wrap overflow-hidden text-ellipsis">
                    {renderEntry(entry)}
                  </Box>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="gray"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeData(tabId, entry.id);
                    }}
                    className="ml-2"
                  >
                    x
                  </Button>
                </Box>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </Box>
      )}
    </Droppable>
  );
};

type FlexibleColumns = {
  col1: (ChartItem | TableItem)[];
  col2: (ChartItem | TableItem)[];
  col3: (ChartItem | TableItem)[];
  col4: (ChartItem | TableItem)[];
};

type ColumnKey = 'col1' | 'col2' | 'col3' | 'col4';

type FilterUnitProps<T extends 'table' | 'filters' | 'charts'> = {
  tabId: string | number;
  columns: FlexibleColumns;
  setColumns: (newColumns: FlexibleColumns) => void;
  index: number;
  type: T;
  schema: GraphQLSchema;
  tabType: string;
  title: string;
};

// FilterUnit Component (Customized for Table, Filters, and Charts)
const FilterUnit = <T extends 'table' | 'filters' | 'charts'>({
  tabId,
  columns,
  setColumns,
  type,
  schema,
  tabType,
  title,
}: FilterUnitProps<T>) => {
  const [fieldName, setFieldName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [chartType, setChartType] = useState('');
  const [lastInsertColumn, setLastInsertColumn] = useState<ColumnKey>('col4');

  const distributeItems = (items: any[]) => {
    const columns: FlexibleColumns = {
      col1: [],
      col2: [],
      col3: [],
      col4: [],
    };
    items.forEach((item, i) => {
      const colKey = `col${(i % 4) + 1}` as keyof FlexibleColumns;
      columns[colKey].push(item);
    });
    return columns;
  };

  const submitData = () => {
    if (!fieldName || !labelName || (type === 'charts' && !chartType)) {
      return;
    }

    const newEntry = { id: Date.now() } as T extends 'charts'
      ? ChartItem
      : TableItem;
    if (type === 'charts') {
      (newEntry as ChartItem).field = fieldName;
      (newEntry as ChartItem).title = labelName;
      (newEntry as ChartItem).chartType = chartType;
    } else {
      (newEntry as TableItem).field = fieldName;
      (newEntry as TableItem).label = labelName;
    }

    const currentItems = [
      ...columns.col1,
      ...columns.col2,
      ...columns.col3,
      ...columns.col4,
    ];

    const updatedItems = [...currentItems, newEntry];
    const newColumns = distributeItems(updatedItems);

    setColumns(newColumns);
    setLastInsertColumn(
      `col${((updatedItems.length - 1) % 4) + 1}` as ColumnKey,
    );
    setFieldName('');
    setLabelName('');
    setChartType('');
  };

  const removeData = (tabId: string | number, entryId: number) => {
    const columnOrder = ['col1', 'col2', 'col3', 'col4'] as const;
    const flatItems: (TableItem | ChartItem)[] = [];
    let removedColId: keyof FlexibleColumns | null = null;

    const maxLength = Math.max(
      ...Object.values(columns).map((col) => col.length),
    );
    for (let i = 0; i < maxLength; i++) {
      columnOrder.forEach((colId) => {
        const key = colId as keyof FlexibleColumns;
        if (columns[key][i]) {
          if (columns[key][i].id === entryId) {
            removedColId = key;
          } else {
            flatItems.push(columns[key][i]);
          }
        }
      });
    }

    if (removedColId) {
      const newColumns: FlexibleColumns = {
        col1: [],
        col2: [],
        col3: [],
        col4: [],
      };
      flatItems.forEach((item, index) => {
        const colIndex = index % 4;
        const colId = columnOrder[colIndex] as keyof FlexibleColumns;
        newColumns[colId].push(item);
      });
      setColumns(newColumns);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const [, sourceColId] = source.droppableId.split('-');
    const [, destColId] = destination.droppableId.split('-');

    const columnOrder = ['col1', 'col2', 'col3', 'col4'];
    const flatItems: (TableItem | ChartItem)[] = [];
    const maxLength = Math.max(
      ...Object.values(columns).map((col) => col.length),
    );
    for (let i = 0; i < maxLength; i++) {
      columnOrder.forEach((colId) => {
        const key = colId as keyof FlexibleColumns;
        if (columns[key][i]) {
          flatItems.push(columns[key][i]); // Correct access using key
        }
      });
    }

    const sourceFlatIndex = columnOrder.indexOf(sourceColId) + source.index;
    const destFlatIndex = columnOrder.indexOf(destColId) + destination.index;

    const [movedItem] = flatItems.splice(sourceFlatIndex, 1);
    flatItems.splice(destFlatIndex, 0, movedItem);

    const newColumns: FlexibleColumns = {
      col1: [],
      col2: [],
      col3: [],
      col4: [],
    };
    flatItems.forEach((item, index) => {
      const colIndex = index % 4;
      const colId = columnOrder[colIndex] as keyof FlexibleColumns;
      newColumns[colId].push(item);
    });

    setColumns(newColumns);
  };

  return (
    <div>
      <Text className="text-start mb-2">{title}</Text>
      <Box className="flex items-start space-x-4 mb-4 w-full overflow-scroll">
        <Box className="flex items-center space-x-4">
          <UnstyledButton
            onClick={submitData}
            className="px-6 py-3 text-white bg-primary rounded-md hover:bg-secondary active:scale-95"
          >
            Add
          </UnstyledButton>
          <Box className="flex flex-col space-y-2 min-w-[300px]">
            <GraphQLAutocomplete
              value={fieldName}
              onChange={setFieldName}
              placeholder="Enter field name (db name)"
              schema={schema as GraphQLSchema}
              context="fieldName"
              tabType={tabType}
            />
            <TextInput
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder={
                type === 'table'
                  ? 'Enter title (label name)'
                  : 'Enter label name'
              }
              className="w-full"
            />
            {type === 'charts' && (
              <TextInput
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                placeholder="Enter chart type (e.g: fullPie, bar or donut )"
                className="w-full"
              />
            )}
          </Box>
        </Box>
        <DragDropContext onDragEnd={onDragEnd}>
          <Box className="flex bg-gray-100 p-3 rounded-lg space-x-3">
            {Object.entries(columns).map(([colId, items]) => (
              <Column
                key={colId}
                columnId={colId}
                items={items}
                removeData={removeData}
                tabId={tabId}
                type={type}
              />
            ))}
          </Box>
        </DragDropContext>
      </Box>
    </div>
  );
};

// Main Component
const EConfigBuilder = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  const { sdata, sisLoading } = useGetSchemaQuery();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [allTabsTitle, setAllTabsTitle] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [newTabName, setNewTabName] = useState('');
  const [newTabType, setNewTabType] = useState(''); // State for Tab Type
  const [, setError] = useState('');
  const [opened, { open, close }] = useDisclosure(false);
  const [configName, setConfigName] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const handlePostConfig = async () => {
    setPostStatus(null); // Clear previous status
    const result = await postConfigContent(allTabsTitle, allTabsConfig); // Replace 'config-name' as needed
    if (result.success) {
      setPostStatus({
        success: true,
        message: 'Configuration posted successfully!',
      });
    } else {
      setPostStatus({
        success: false,
        message: result.error || 'Failed to post config',
      });
    }
    setTimeout(() => setPostStatus(null), 3000);
  };

  const addTab = () => {
    if (!newTabName.trim()) {
      setError('Tab name cannot be empty!');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const newId = tabs.length + 1;
    const newTab: Tab = {
      id: newId,
      label: newTabName.trim(),
      tabType: newTabType.trim(),
      filterUnits: [
        {
          title: 'Table Column Names',
          type: 'table' as const,
          columns: { col1: [], col2: [], col3: [], col4: [] },
        },
        {
          title: 'Filters',
          type: 'filters' as const,
          columns: { col1: [], col2: [], col3: [], col4: [] },
        },
        {
          title: 'Charts',
          type: 'charts' as const,
          columns: { col1: [], col2: [], col3: [], col4: [] },
        },
      ],
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newId.toString());
    setNewTabName('');
    setNewTabType('');
    setError('');
  };

  const removeTab = (id: string | number) => {
    const newTabs = tabs.filter((tab: Tab) => tab.id !== id);
    setTabs(newTabs);
    if (newTabs.length > 0) {
      const newActiveTab =
        newTabs.find((tab: Tab) => tab.id.toString() !== activeTab) ||
        newTabs[0];
      setActiveTab(newActiveTab.id.toString());
    } else {
      setActiveTab('');
    }
  };

  const resetTabs = () => {
    setTabs([]);
    setActiveTab('');
    setNewTabName('');
    setNewTabType('');
    setAllTabsTitle('');
    setError('');
  };

  type FilterUnitType<T extends 'table' | 'filters' | 'charts'> = {
    type: T;
    columns: FlexibleColumns;
    title: string;
  };

  // Define the tab structure
  type Tab = {
    id: string | number;
    label: string;
    tabType: string;
    filterUnits: FilterUnitType<'table' | 'filters' | 'charts'>[];
  };
  interface ApiResponse {
    success: boolean;
    error?: string;
  }

  const fetchConfigContent = async (
    name: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const url = `${GEN3_API}/ExplorerConfig/${name}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const config = await response.json();
      return { success: true, data: config };
    } catch (err) {
      console.error('Error fetching explorer config:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  const postConfigContent = async (
    name: string,
    configData: CohortPanelConfig[],
  ): Promise<ApiResponse> => {
    try {
      const url = `${GEN3_API}/ExplorerConfig/${name}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData, null, 2),
      });

      if (!response.ok) {
        throw new Error(`Failed to post config: ${response.status}`);
      }

      const config = await response.json();
      console.log('CONFIG: ', config);
      return { success: true };
    } catch (err) {
      console.error('Error posting explorer config:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  const loadConfig = async () => {
    if (!configName) {
      setLoadError('Please enter a config name');
      return;
    }
    setLoadError(null);
    const result = await fetchConfigContent(configName);
    if (result.success && result.data) {
      const { Name, content } = result.data;
      setAllTabsTitle(Name || '');

      const loadedTabs = content.map(
        (tabConfig: CohortPanelConfig, index: number) => {
          const tableItems = Object.entries(tabConfig.table.columns || {}).map(
            ([field, col]) => ({
              id: Date.now() + Math.random(),
              field,
              label: col.title,
            }),
          );

          const filterItems = tabConfig.filters.tabs[0].fields.map(
            (field: string, idx: number) => ({
              id: Date.now() + Math.random() + idx,
              field,
              label:
                tabConfig.filters.tabs[0].fieldsConfig[field]?.label || field,
            }),
          );

          const chartItems = Object.entries(tabConfig.charts || {}).map(
            ([field, chart]) => ({
              id: Date.now() + Math.random(),
              field,
              title: chart.title,
              chartType: chart.chartType,
            }),
          );

          const distributeItems = (items: any[]) => {
            const columns: FlexibleColumns = {
              col1: [],
              col2: [],
              col3: [],
              col4: [],
            };
            items.forEach((item, i) => {
              const colKey = `col${(i % 4) + 1}` as keyof FlexibleColumns;
              columns[colKey].push(item);
            });
            return columns;
          };

          return {
            id: index + 1,
            label: tabConfig.tabTitle,
            tabType: tabConfig.guppyConfig.dataType,
            filterUnits: [
              {
                title: 'Table Column Names',
                type: 'table' as const,
                columns: distributeItems(tableItems),
              },
              {
                title: 'Filters',
                type: 'filters' as const,
                columns: distributeItems(filterItems),
              },
              {
                title: 'Charts',
                type: 'charts' as const,
                columns: distributeItems(chartItems),
              },
            ],
          };
        },
      );

      setTabs(loadedTabs);
      if (loadedTabs.length > 0) {
        setActiveTab(loadedTabs[0].id.toString());
      }
      close(); // Close modal on success
      setConfigName(''); // Reset input
    } else {
      setError(result.error || 'Failed to load config');
      setLoadError(result.error || 'Failed to load config');
      setTimeout(() => setError(''), 3000);
    }
  };

  const allTabsConfig: CohortPanelConfig[] = tabs.map((tab: Tab) => {
    const columnOrder = ['col1', 'col2', 'col3', 'col4'] as const;
    const tableItems: TableItem[] = [];
    const filterItems: TableItem[] = [];
    const chartItems: ChartItem[] = [];

    tab.filterUnits.forEach(
      (unit: FilterUnitType<'table' | 'filters' | 'charts'>) => {
        const flatItems: (TableItem | ChartItem)[] = [];
        const maxLength = Math.max(
          ...Object.values(unit.columns).map((col) => col.length),
        );
        for (let i = 0; i < maxLength; i++) {
          columnOrder.forEach((colId) => {
            const key = colId as keyof ColumnProps<
              'table' | 'filters' | 'charts'
            >;
            if (unit.columns[key as ColumnKey][i]) {
              flatItems.push(unit.columns[key as ColumnKey][i]);
            }
          });
        }

        if (unit.type === 'table') {
          tableItems.push(...(flatItems as TableItem[]));
        } else if (unit.type === 'filters') {
          filterItems.push(...(flatItems as TableItem[]));
        } else if (unit.type === 'charts') {
          chartItems.push(...(flatItems as ChartItem[]));
        }
      },
    );

    return {
      tabTitle: tab.label,
      guppyConfig: {
        dataType: tab.tabType,
        nodeCountTitle: `${tab.tabType} Count`,
        fieldMapping: [],
      },
      charts: chartItems.reduce((acc: Record<string, SummaryChart>, item) => {
        acc[item.field] = {
          chartType: item.chartType,
          title: item.title,
        };
        return acc;
      }, {}),
      filters: {
        tabs: [
          {
            title: 'Filters',
            fields: filterItems.map((item) => item.field) as readonly string[],
            fieldsConfig: filterItems.reduce(
              (acc: Record<string, FacetDefinition>, item) => {
                acc[item.field] = {
                  field: item.field,
                  dataField: '', // placeholder
                  index: '', // placeholder
                  label: item.label,
                  type: 'enum' as FacetType, // can also be 'multiselect'
                };
                return acc;
              },
              {},
            ),
          },
        ],
      } as TabsConfig,
      table: {
        enabled: true,
        fields: tableItems.map((item) => item.field) as readonly string[],
        columns: tableItems.reduce(
          (acc: Record<string, SummaryTableColumn>, item) => {
            acc[item.field] = {
              field: item.field,
              title: item.label,
            };
            return acc;
          },
          {},
        ),
      } as SummaryTable,
      dropdowns: {},
      buttons: [],
      loginForDownload: false,
    };
  });

  const copyAllContent = () => {
    navigator.clipboard.writeText(JSON.stringify(allTabsConfig, null, 2));
  };

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 Explorer Builder Page',
        content: 'Explorer Builder Page',
        key: 'explorer-builder-page',
      }}
    >
      <div className="w-full m-10">
        <Center>
          <Box className="p-4 border border-gray-300 rounded-lg max-w-screen-xl">
            <Text className="text-xl text-center m-2">
              Explorer Configuration Builder
            </Text>
            <Box className="flex items-center">
              <Box className="flex space-x-2 shrink-0 pb-2">
                {tabs.length ? (
                  <React.Fragment>
                    <Button
                      onClick={copyAllContent}
                      variant="outline"
                      color="primary.0"
                      className="px-4 py-2"
                      disabled={!tabs.length}
                    >
                      Copy Config
                    </Button>
                    <Button
                      onClick={handlePostConfig}
                      variant="outline"
                      color="primary.0"
                      className="px-4 py-2"
                      disabled={!tabs.length}
                    >
                      Post Config
                    </Button>
                    {postStatus && (
                      <Alert
                        color={postStatus.success ? 'green' : 'red'}
                        title={postStatus.success ? 'Success' : 'Error'}
                        mt="xs"
                        withCloseButton
                        onClose={() => setPostStatus(null)}
                      >
                        <Text size="sm">{postStatus.message}</Text>
                      </Alert>
                    )}

                    <Button
                      onClick={open}
                      variant="outline"
                      color="primary.0"
                      className="px-4 py-2"
                    >
                      Load Config
                    </Button>
                    <Modal
                      opened={opened}
                      onClose={() => {
                        close();
                        setLoadError(null); // Clear error when closing
                      }}
                      title="Load Configuration"
                      centered
                    >
                      <TextInput
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="Enter config name"
                        label="Config Name"
                        required
                        error={loadError} // Display error below input
                      />
                      <Group justify="flex-end" mt="md">
                        <Button onClick={close} variant="subtle" color="gray">
                          Cancel
                        </Button>
                        <Button
                          onClick={loadConfig}
                          color="primary.0"
                          disabled={!configName}
                        >
                          Load
                        </Button>
                      </Group>
                    </Modal>

                    <Button
                      onClick={() => {
                        if (
                          window.confirm(
                            'Are you sure you want to reset? All existing data will be lost',
                          )
                        ) {
                          resetTabs();
                        }
                      }}
                      variant="outline"
                      color="red"
                      className="px-4 py-2"
                      disabled={!tabs.length}
                    >
                      Reset
                    </Button>
                  </React.Fragment>
                ) : null}
              </Box>
              <Box className="flex overflow-x-scroll mx-4 max-w-full pb-2">
                {tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id.toString())}
                    variant={
                      activeTab === tab.id.toString() ? 'filled' : 'subtle'
                    }
                    color={
                      activeTab === tab.id.toString() ? 'primary.0' : 'gray'
                    }
                    className="px-4 py-2 flex items-center min-w-min"
                    rightSection={
                      <Button
                        variant="subtle"
                        color="gray"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTab(tab.id);
                        }}
                        className="ml-2"
                      >
                        x
                      </Button>
                    }
                  >
                    {tab.label}
                  </Button>
                ))}
              </Box>
              <Box className="flex items-center space-x-2 shrink-0 pb-2">
                <TextInput
                  value={allTabsTitle}
                  onChange={(e) => setAllTabsTitle(e.target.value)}
                  placeholder="Config Page Name"
                  className="w-40 mx-2"
                />
                <TextInput
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="Tab Name"
                  className="w-40"
                  onKeyPress={(e) => e.key === 'Enter' && addTab()}
                />
                {!sisLoading ? (
                  <GraphQLAutocomplete
                    value={newTabType}
                    onChange={setNewTabType}
                    placeholder="Tab Type"
                    schema={sdata as GraphQLSchema}
                    context="tabType"
                    tabType={''}
                  />
                ) : (
                  <Loader color="primary.0" />
                )}
                <Button
                  onClick={addTab}
                  color="primary.0"
                  className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-secondary"
                >
                  +
                </Button>
              </Box>
            </Box>
            <Box className="p-2">
              {tabs.map(
                (tab) =>
                  tabs.length > 0 &&
                  activeTab === tab.id.toString() && (
                    <Box key={tab.id}>
                      {tab.filterUnits.map((unit, index) => (
                        <FilterUnit
                          key={index}
                          tabId={tab.id}
                          columns={unit.columns}
                          setColumns={(newColumns) =>
                            setTabs(
                              tabs.map((t) =>
                                t.id === tab.id
                                  ? {
                                      ...t,
                                      filterUnits: t.filterUnits.map((u, i) =>
                                        i === index
                                          ? { ...u, columns: newColumns }
                                          : u,
                                      ),
                                    }
                                  : t,
                              ),
                            )
                          }
                          type={unit.type}
                          schema={sdata as GraphQLSchema}
                          tabType={tab.tabType}
                          title={unit.title}
                          index={index}
                        />
                      ))}
                    </Box>
                  ),
              )}
            </Box>
          </Box>
        </Center>
      </div>
    </NavPageLayout>
  );
};

export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default EConfigBuilder;
