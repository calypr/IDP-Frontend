import { useState, useMemo } from 'react';
import { Center, Box, Text } from '@mantine/core';
import { NavPageLayout } from '../../features/Navigation';
import { useGetSchemaQuery } from './hooks';
import { FilterUnit } from './filterUnit';
import TabBar from './TabBar';
import ConfigControls from './ConfigControls';
import { buildConfigFromTabs } from './utils';
import { ConfiguratorPageProps, type Tab } from './types';
import { GraphQLSchema } from 'graphql';

const Configurator = ({
  headerProps,
  footerProps,
  configuratorConfig,
}: ConfiguratorPageProps) => {
  const { sdata, sisLoading } = useGetSchemaQuery();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [allTabsTitle, setAllTabsTitle] = useState('');
  const [activeTab, setActiveTab] = useState('');

  const allTabsConfig = useMemo(() => buildConfigFromTabs(tabs), [tabs]);

  const addTab = (name: string, type: string) => {
    const newId = tabs.length + 1;
    const newTab: Tab = {
      id: newId,
      label: name,
      tabType: type,
      filterUnits: [
        {
          title: 'Table Column Names',
          type: 'table',
          columns: { col1: [], col2: [], col3: [], col4: [] },
        },
        {
          title: 'Filters',
          type: 'filters',
          columns: { col1: [], col2: [], col3: [], col4: [] },
        },
        {
          title: 'Charts',
          type: 'charts',
          columns: { col1: [], col2: [], col3: [], col4: [] },
        },
      ],
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newId.toString());
  };

  const removeTab = (id: string | number) => {
    const newTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(newTabs);
    if (newTabs.length > 0) setActiveTab(newTabs[0].id.toString());
    else setActiveTab('');
  };

  const resetTabs = () => {
    setTabs([]);
    setActiveTab('');
    setAllTabsTitle('');
  };

  const copyAllContent = () => {
    navigator.clipboard.writeText(JSON.stringify(allTabsConfig, null, 2));
  };

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
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
            <ConfigControls
              tabs={tabs}
              setTabs={setTabs}
              allTabsTitle={allTabsTitle}
              setAllTabsTitle={setAllTabsTitle}
              setActiveTab={setActiveTab}
              onCopyConfig={copyAllContent}
              onReset={resetTabs}
            />
            <TabBar
              tabs={tabs}
              activeTab={activeTab}
              onTabClick={setActiveTab}
              onRemoveTab={removeTab}
              onAddTab={addTab}
              sdata={sdata as GraphQLSchema}
              sisLoading={sisLoading}
            />
            <Box className="p-2">
              {tabs.map(
                (tab) =>
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

export default Configurator;
