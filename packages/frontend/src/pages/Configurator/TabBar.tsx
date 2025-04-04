import { useState } from 'react';
import { Box, Button, TextInput, Loader, Text } from '@mantine/core';
import { GraphQLAutocomplete } from './graphqlAutoComplete';
import { GraphQLSchema } from 'graphql';
import { Tab } from './types';

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabClick: (tabId: string) => void;
  onRemoveTab: (tabId: number | string) => void;
  onAddTab: (name: string, type: string) => void;
  sdata: GraphQLSchema; // Allow undefined since schema might not be loaded yet
  sisLoading: boolean;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabClick,
  onRemoveTab,
  onAddTab,
  sdata,
  sisLoading,
}) => {
  const [newTabName, setNewTabName] = useState('');
  const [newTabType, setNewTabType] = useState('');
  const [error, setError] = useState('');

  const handleAddTab = () => {
    if (!newTabName.trim()) {
      setError('Tab name cannot be empty!');
      setTimeout(() => setError(''), 3000);
      return;
    }
    onAddTab(newTabName.trim(), newTabType.trim());
    setNewTabName('');
    setNewTabType('');
    setError('');
  };

  return (
    <Box className="flex items-center space-x-2 shrink-0 pb-2">
      <Box className="flex overflow-x-scroll mx-4 max-w-full pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => onTabClick(tab.id.toString())}
            variant={activeTab === tab.id.toString() ? 'filled' : 'subtle'}
            color={activeTab === tab.id.toString() ? 'primary.0' : 'gray'}
            className="px-4 py-2 flex items-center min-w-min"
            rightSection={
              <Button
                variant="subtle"
                color="gray"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTab(tab.id);
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
      <TextInput
        value={newTabName}
        onChange={(e) => setNewTabName(e.target.value)}
        placeholder="Tab Name"
        className="w-40"
        onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
      />
      {!sisLoading ? (
        <GraphQLAutocomplete
          value={newTabType}
          onChange={setNewTabType}
          placeholder="Tab Type"
          schema={sdata}
          context="tabType"
          tabType={''}
        />
      ) : (
        <Loader color="primary.0" />
      )}
      <Button
        onClick={handleAddTab}
        color="primary.0"
        className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-secondary"
      >
        +
      </Button>
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
};

export default TabBar;
