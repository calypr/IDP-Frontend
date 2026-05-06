import React, { DragEvent, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import {
  DeleteIcon,
  DownloadIcon,
  UploadIcon,
  WarningTriangleIcon,
} from '../../types/icons';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { formatBytes } from '../../utils/labels';
import { useUploadController } from './useUploadController';

const statusColorMap = {
  complete: 'green',
  error: 'red',
  hashing: 'blue',
  queued: 'gray',
  registering: 'violet',
  uploading: 'cyan',
} as const;

const statusLabelMap = {
  complete: 'Complete',
  error: 'Error',
  hashing: 'Hashing',
  queued: 'Queued',
  registering: 'Registering',
  uploading: 'Uploading',
} as const;

const Upload = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasAttemptedUpload, setHasAttemptedUpload] = useState(false);
  const {
    addFiles,
    clearFinishedItems,
    hasBuckets,
    isBucketsLoading,
    isOrganizationSelectionRequired,
    isProjectSelectionRequired,
    isUploading,
    organizationOptions,
    projectOptions,
    queue,
    downloadItem,
    removeItem,
    selectedOrganization,
    selectedProject,
    setSelectedOrganization,
    setSelectedProject,
    setSubdirectory,
    startUpload,
    subdirectory,
  } = useUploadController();

  const queueSummary = useMemo(
    () => ({
      count: queue.length,
      size: queue.reduce((sum, item) => sum + item.file.size, 0),
      queuedCount: queue.filter((item) => item.status === 'queued').length,
    }),
    [queue],
  );

  const showOrganizationError =
    hasAttemptedUpload && !selectedOrganization && queue.length > 0;
  const showProjectError =
    hasAttemptedUpload &&
    !!selectedOrganization &&
    isProjectSelectionRequired &&
    queue.length > 0;

  const onStartUpload = async () => {
    setHasAttemptedUpload(true);
    await startUpload();
  };

  const onFilesSelected = (files: FileList | null) => {
    if (!files) return;
    addFiles(Array.from(files));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onFilesSelected(event.dataTransfer.files);
  };

  if (!isBucketsLoading && !hasBuckets) {
    return null;
  }

  return (
    <ProtectedContent>
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <Stack gap="lg">
          <div>
            <Text size="xl" fw={700}>
              Upload
            </Text>
            <Text c="dimmed" size="sm">
              Upload local files to a Syfon bucket and register them as DRS
              objects.
            </Text>
          </div>

          <Paper withBorder p="lg" radius="sm">
            <Stack gap="lg">
              <Group grow align="end">
                <Select
                  label="Organization"
                  placeholder={
                    isBucketsLoading
                      ? 'Loading organizations...'
                      : organizationOptions.length === 0
                        ? 'No organizations available'
                        : 'Select an organization'
                  }
                  data={organizationOptions}
                  value={selectedOrganization}
                  onChange={(value) => setSelectedOrganization(value ?? '')}
                  disabled={isUploading || organizationOptions.length <= 1}
                  rightSection={isBucketsLoading ? <Loader size="xs" /> : null}
                  searchable={organizationOptions.length > 6}
                />
                <Select
                  label="Project"
                  placeholder={
                    !selectedOrganization
                      ? 'Select an organization first'
                      : projectOptions.length === 0
                        ? 'No project required'
                        : 'Select a project'
                  }
                  data={projectOptions}
                  value={selectedProject}
                  onChange={(value) => setSelectedProject(value ?? '')}
                  disabled={
                    isUploading ||
                    !selectedOrganization ||
                    projectOptions.length <= 1
                  }
                  searchable={projectOptions.length > 6}
                />
                <TextInput
                  label="Subdirectory"
                  placeholder="optional/path/inside/bucket"
                  value={subdirectory}
                  onChange={(event) => setSubdirectory(event.currentTarget.value)}
                  disabled={isUploading}
                />
              </Group>

              {showOrganizationError ? (
                <Alert
                  color="yellow"
                  icon={<WarningTriangleIcon />}
                  title="Organization required"
                >
                  Select an organization before starting the upload batch.
                </Alert>
              ) : null}
              {showProjectError ? (
                <Alert
                  color="yellow"
                  icon={<WarningTriangleIcon />}
                  title="Project required"
                >
                  Select the project for this organization before starting the
                  upload batch.
                </Alert>
              ) : null}

              <div
                className="flex min-h-56 cursor-pointer flex-col items-center justify-center border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                aria-label="Choose files to upload"
              >
                <UploadIcon size="2rem" />
                <Text mt="sm" fw={600}>
                  Drop files here
                </Text>
                <Text size="sm" c="dimmed">
                  or click to choose files from your computer
                </Text>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => onFilesSelected(event.target.files)}
                />
              </div>

              <Group justify="space-between" align="center">
                <Group gap="md">
                  <Text size="sm" c="dimmed">
                    {queueSummary.count} file{queueSummary.count === 1 ? '' : 's'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatBytes(queueSummary.size)}
                  </Text>
                </Group>
                <Group gap="sm">
                  <Button
                    variant="default"
                    onClick={clearFinishedItems}
                    disabled={isUploading || queue.length === 0}
                  >
                    Clear Finished
                  </Button>
                  <Button
                    leftSection={<UploadIcon size="1rem" />}
                    onClick={() => void onStartUpload()}
                    disabled={isUploading || queueSummary.queuedCount === 0}
                    loading={isUploading}
                  >
                    Upload Files
                  </Button>
                </Group>
              </Group>

              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Progress</Table.Th>
                    <Table.Th>DRS ID</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {queue.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text size="sm" c="dimmed">
                          No files queued yet.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    queue.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <div>
                            <Text size="sm" fw={600}>
                              {item.file.name}
                            </Text>
                            {item.objectKey ? (
                              <Text size="xs" c="dimmed">
                                {item.objectKey}
                              </Text>
                            ) : null}
                            {item.error ? (
                              <Text size="xs" c="red">
                                {item.error}
                              </Text>
                            ) : null}
                          </div>
                        </Table.Td>
                        <Table.Td>{formatBytes(item.file.size)}</Table.Td>
                        <Table.Td>
                          <Badge color={statusColorMap[item.status]} variant="light">
                            {statusLabelMap[item.status]}
                          </Badge>
                        </Table.Td>
                        <Table.Td miw={180}>
                          <Stack gap={4}>
                            <Progress value={item.progress} size="sm" />
                            <Text size="xs" c="dimmed">
                              {item.progress}% ({formatBytes(item.uploadedBytes)} /{' '}
                              {formatBytes(item.file.size)})
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {item.objectId ?? item.drsObject?.id ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td w={96}>
                          <Group gap={4} justify="flex-end">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={`Download ${item.file.name}`}
                              onClick={() => void downloadItem(item.id)}
                              disabled={
                                !item.drsObject?.id && !item.objectId
                              }
                            >
                              <DownloadIcon size="1rem" />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={`Remove ${item.file.name}`}
                              onClick={() => void removeItem(item.id)}
                              disabled={isUploading}
                            >
                              <DeleteIcon size="1rem" />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          </Paper>
        </Stack>
      </div>
    </ProtectedContent>
  );
};

export default Upload;
