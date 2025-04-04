// ConfigControls.tsx
import React, { useState } from 'react';
import {
  Box,
  Button,
  TextInput,
  Modal,
  Group,
  Alert,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { type Tab, type ApiResponse } from './types'; // Adjust import path as needed

// Define the props type
interface ConfigControlsProps {
  tabs: Tab[];
  allTabsTitle: string;
  setAllTabsTitle: React.Dispatch<React.SetStateAction<string>>;
  onCopyConfig: () => void;
  onPostConfig: () => Promise<ApiResponse>;
  onLoadConfig: (name: string) => Promise<void>;
  onReset: () => void;
}

const ConfigControls: React.FC<ConfigControlsProps> = ({
  tabs,
  allTabsTitle,
  setAllTabsTitle,
  onCopyConfig,
  onPostConfig,
  onLoadConfig,
  onReset,
}) => {
  const [opened, { open, close }] = useDisclosure(false);
  const [configName, setConfigName] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  const handlePost = async () => {
    setPostStatus(null);
    const result = await onPostConfig();
    setPostStatus(result);
    setTimeout(() => setPostStatus(null), 3000);
  };

  const handleLoad = async () => {
    if (!configName) {
      setLoadError('Please enter a config name');
      return;
    }
    setLoadError(null);
    await onLoadConfig(configName);
    setConfigName('');
    close();
  };

  return (
    <Box className="flex space-x-2 shrink-0 pb-2">
      <TextInput
        value={allTabsTitle}
        onChange={(e) => setAllTabsTitle(e.target.value)}
        placeholder="Config Page Name"
        className="w-40 mx-2"
      />
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
        onClick={handlePost}
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
          setLoadError(null);
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
          error={loadError}
        />
        <Group justify="flex-end" mt="md">
          <Button onClick={close} variant="subtle" color="gray">
            Cancel
          </Button>
          <Button onClick={handleLoad} color="primary.0" disabled={!configName}>
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
