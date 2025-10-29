import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import {
  Box,
  Button,
  TextInput,
  Modal,
  Group,
  Alert,
  Text,
  Select,
  Loader,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { Tab } from './types';
import {
  useGetConfigContentQuery,
  useUpdateConfigContentMutation,
} from '@gen3/core';
import { transformConfigToTabs, buildConfigFromTabs } from './utils';
import { useConfigList } from './hooks';
import { SerializedError } from '@reduxjs/toolkit';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';

// Define JSONObject to match hook's expectation
interface JSONObject {
  [key: string]: any; // Relaxed type to allow any JSON-like structure
}

interface ConfigControlsProps {
  tabs: Tab[];
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  allTabsTitle?: string; // Made optional to fix TS2741
  setAllTabsTitle: Dispatch<SetStateAction<string>>;
  setActiveTab: Dispatch<SetStateAction<string>>;
  onCopyConfig: () => void;
  onReset: () => void;
}

const ConfigControls = ({
  tabs,
  setTabs,
  setAllTabsTitle,
  setActiveTab,
  onCopyConfig,
  onReset,
}: ConfigControlsProps) => {
  const [postModalOpened, { open: openPostModal, close: closePostModal }] =
    useDisclosure(false);
  const [loadModalOpened, { open: openLoadModal, close: closeLoadModal }] =
    useDisclosure(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);

  const {
    configList,
    configListData,
    configListIsLoading,
    configListError,
    refetchConfigList,
  } = useConfigList();

  const {
    data: configData,
    error: configError,
    isFetching: configIsFetching,
  } = useGetConfigContentQuery(selectedConfig as string, {
    skip: !selectedConfig,
  });

  const [
    updateConfig,
    { data: postData, error: postErrorResponse, isLoading: isUpdating },
  ] = useUpdateConfigContentMutation();

  // Handle loading configuration
  useEffect(() => {
    if (configData?.success && configData.data && selectedConfig) {
      const configContent = configData?.data?.content?.explorerConfig ?? [];
      console.log('CONFIG DATdsfsdfA: ', configContent);
      const loadedTabs = transformConfigToTabs(configContent);
      setTabs(loadedTabs);
      setAllTabsTitle(selectedConfig); // selectedConfig is string here due to skip: !selectedConfig
      if (loadedTabs.length > 0) setActiveTab(loadedTabs[0].id.toString());
      closeLoadModal();
      setSelectedConfig(null);
    }
  }, [
    configData,
    selectedConfig,
    setTabs,
    setAllTabsTitle,
    setActiveTab,
    closeLoadModal,
  ]);

  // Handle posting configuration
  const handlePost = () => {
    if (!newConfigName.trim()) return;
    const config = buildConfigFromTabs(tabs);
    const configDataToPost: JSONObject = {
      sharedFilters: config.sharedFilters || {}, // Replace undefined with empty object
      explorerConfig: config.explorerConfig || [],
    };
    updateConfig({
      name: newConfigName.trim(),
      configData: configDataToPost,
    }).then((result) => {
      if (result.data?.success) {
        closePostModal();
        setNewConfigName('');
        refetchConfigList();
      }
    });
  };

  const handleLoad = () => {
    if (!selectedConfig) return;
    // Loading handled by useEffect
  };

  // Helper to extract error message
  const getErrorMessage = (
    error: SerializedError | FetchBaseQueryError | undefined,
  ): string => {
    if (!error) return 'Unknown error';
    if ('status' in error) {
      // FetchBaseQueryError
      const errorData = (error.data as { error?: string }) || {};
      return errorData.error || `Error (Status: ${error.status})`;
    }
    // SerializedError
    return error.message || 'Unknown error';
  };

  return (
    <Box className="flex space-x-2 shrink-0 pb-2">
      <Button
        onClick={onCopyConfig}
        variant="outline"
        color="primary.0"
        className="px-4 py-2"
        disabled={!tabs.length}
      >
        Copy Config
      </Button>
      <Button
        onClick={openPostModal}
        variant="outline"
        color="primary.0"
        className="px-4 py-2"
        disabled={!tabs.length}
      >
        Post Config
      </Button>
      <Modal
        opened={postModalOpened}
        onClose={() => {
          closePostModal();
          setNewConfigName('');
        }}
        title="Post Configuration"
        centered
      >
        <TextInput
          value={newConfigName}
          onChange={(e) => setNewConfigName(e.target.value)}
          placeholder="Enter config name"
          label="Config Name"
          required
          error={
            newConfigName && !newConfigName.trim()
              ? 'Config name cannot be empty'
              : null
          }
        />
        {postErrorResponse && (
          <Alert color="red" mt="md" title="Error">
            {getErrorMessage(postErrorResponse)}
          </Alert>
        )}
        <Group justify="flex-end" mt="md">
          <Button onClick={closePostModal} variant="subtle" color="gray">
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            color="primary.0"
            disabled={!newConfigName.trim() || isUpdating}
          >
            {isUpdating ? <Loader size="sm" /> : 'Post'}
          </Button>
        </Group>
      </Modal>

      <Button
        onClick={() => {
          openLoadModal();
          refetchConfigList();
        }}
        variant="outline"
        color="primary.0"
        className="px-4 py-2"
      >
        Load Config
      </Button>
      <Modal
        opened={loadModalOpened}
        onClose={() => {
          closeLoadModal();
          setSelectedConfig(null);
        }}
        title="Load Configuration"
        centered
      >
        {configListIsLoading ? (
          <Loader />
        ) : configListError ? (
          <Alert color="red" title="Error">
            {getErrorMessage(configListError)}
          </Alert>
        ) : configList.length === 0 ? (
          <Text>No configurations available</Text>
        ) : (
          <>
            <Select
              label="Select Configuration"
              placeholder="Choose a config"
              data={configList}
              value={selectedConfig}
              onChange={setSelectedConfig}
              searchable
              error={configError ? getErrorMessage(configError) : null}
            />
          </>
        )}
        <Group justify="flex-end" mt="md">
          <Button onClick={closeLoadModal} variant="subtle" color="gray">
            Cancel
          </Button>
          <Button
            onClick={handleLoad}
            color="primary.0"
            disabled={!selectedConfig || configIsFetching}
          >
            {configIsFetching ? <Loader size="sm" /> : 'Load'}
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
            onReset();
          }
        }}
        variant="outline"
        color="red"
        className="px-4 py-2"
        disabled={!tabs.length}
      >
        Reset
      </Button>
    </Box>
  );
};

export default ConfigControls;
