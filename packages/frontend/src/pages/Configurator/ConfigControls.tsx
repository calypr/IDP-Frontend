import React, { useState } from 'react';
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
import { type Tab } from './types';
import {
  ApiResponse,
  useGetConfigContentQuery,
  useUpdateConfigContentMutation,
  useGetConfigListQuery,
} from '@gen3/core';
import { transformConfigToTabs } from './utils';

interface ConfigControlsProps {
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  allTabsTitle: string;
  setAllTabsTitle: React.Dispatch<React.SetStateAction<string>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  onCopyConfig: () => void;
  onReset: () => void;
}

const ConfigControls: React.FC<ConfigControlsProps> = ({
  tabs,
  setTabs,
  allTabsTitle,
  setAllTabsTitle,
  setActiveTab,
  onCopyConfig,
  onReset,
}) => {
  const [postModalOpened, { open: openPostModal, close: closePostModal }] =
    useDisclosure(false);
  const [loadModalOpened, { open: openLoadModal, close: closeLoadModal }] =
    useDisclosure(false);
  const [newConfigName, setNewConfigName] = useState<string>('');
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  // Fetch the list of available configs
  const { data: configListData, isLoading: configListIsLoading } =
    useGetConfigListQuery('');
  const configList = configListData?.data as string[] | undefined;

  // Fetch config content when a config is selected
  const {
    data: configData,
    error: configError,
    isFetching: configIsFetching,
  } = useGetConfigContentQuery(selectedConfig || '', {
    skip: !selectedConfig,
  });

  // Mutation for posting/updating config
  const [updateConfig, { isLoading: isUpdating }] =
    useUpdateConfigContentMutation();

  // Handle posting a new config
  const handlePost = async () => {
    if (!newConfigName.trim()) {
      setPostError('Please enter a config name');
      return;
    }
    setPostError(null);
    setAllTabsTitle(newConfigName.trim());
    setPostStatus(null);

    try {
      const result = await updateConfig({
        name: newConfigName.trim(),
        configData: tabs.map((tab) => ({
          /* Transform tab to config data */
        })),
      }).unwrap();
      setPostStatus({
        success: result.success,
        message: result.success ? 'Config posted successfully' : result.error,
      });
      setNewConfigName('');
      closePostModal();
      setTimeout(() => setPostStatus(null), 3000);
    } catch (err) {
      setPostError('Failed to post configuration');
    }
  };

  // Handle loading a selected config
  const handleLoad = async () => {
    if (!selectedConfig) {
      setLoadError('Please select a configuration');
      return;
    }
    setLoadError(null);

    if (configData?.success && configData.data) {
      setAllTabsTitle(configData.data.Name || '');
      const loadedTabs = transformConfigToTabs(configData.data.content);
      setTabs(loadedTabs);
      if (loadedTabs.length > 0) setActiveTab(loadedTabs[0].id.toString());
      setSelectedConfig(null);
      closeLoadModal();
    } else if (configError) {
      setLoadError(
        (configError as any).error || 'Failed to load configuration',
      );
    }
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
          setPostError(null);
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
          error={postError}
        />
        <Group justify="flex-end" mt="md">
          <Button onClick={closePostModal} variant="subtle" color="gray">
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            color="primary.0"
            disabled={!newConfigName || isUpdating}
          >
            {isUpdating ? <Loader size="sm" /> : 'Post'}
          </Button>
        </Group>
      </Modal>
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
        onClick={openLoadModal}
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
          setLoadError(null);
          setSelectedConfig(null);
        }}
        title="Load Configuration"
        centered
      >
        {configListIsLoading ? (
          <Loader />
        ) : (
          <Select
            label="Select Configuration"
            placeholder="Choose a config"
            data={
              configList?.map((config) => ({ value: config, label: config })) ||
              []
            }
            value={selectedConfig}
            onChange={setSelectedConfig}
            error={loadError}
            searchable
          />
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
