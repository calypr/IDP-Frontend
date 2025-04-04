import React, { useState } from 'react';
import { type GraphQLSchema } from 'graphql';
import {
  Center,
  Box,
  Button,
  TextInput,
  Text,
  Loader,
  Modal,
  Group,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NavPageLayout, NavPageLayoutProps } from '../../features/Navigation';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import {
  type SummaryTable,
  type TabsConfig,
  type CohortPanelConfig,
  type SummaryTableColumn,
} from '../../features/CohortBuilder';
import { type SummaryChart } from '../../components/charts';
import { type FacetDefinition, FacetType, GEN3_API } from '@gen3/core';
import { GetServerSideProps } from 'next';
import {
  ConfiguratorPageProps,
  type FilterUnitType,
  type Tab,
  type FlexibleColumns,
  type TableItem,
  type ChartItem,
  type ColumnKey,
  type ColumnProps,
} from './types';
import { GraphQLAutocomplete } from './graphqlAutoComplete';
import { useGetSchemaQuery } from './hooks';
import { FilterUnit } from './filterUnit';

// FilterUnit Component (Customized for Table, Filters, and Charts)

// Main Component
const Configurator = ({
  headerProps,
  footerProps,
  configuratorConfig,
}: ConfiguratorPageProps) => {
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
          const tableItems = Object.entries(tabConfig.table?.columns || {}).map(
            ([field, col]) => ({
              id: Date.now() + Math.random(),
              field,
              label: col.title,
            }),
          );

          const filterItems = tabConfig.filters?.tabs[0].fields.map(
            (field: string, idx: number) => ({
              id: Date.now() + Math.random() + idx,
              field,
              label:
                tabConfig.filters?.tabs[0].fieldsConfig[field]?.label || field,
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
                columns: distributeItems(filterItems ?? []),
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

export default Configurator;
