import React, { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Modal,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import {
  useAttachGeckoGitUploadSessionFilesMutation,
  useCreateGeckoGitUploadSessionMutation,
  useFinalizeGeckoGitUploadSessionMutation,
  type GeckoGitRef,
  type GeckoGitUploadSessionResponse,
} from '@gen3/core';
import { IconGitPullRequest, IconUpload, IconAlertCircle } from '@tabler/icons-react';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { useUploadController } from '../../features/Upload/useUploadController';
import type { UploadQueueItem } from '../../features/Upload/types';
import { formatBytes } from '../../utils/labels';

const buildTargetPath = (subdirectory: string, fileName: string): string => {
  const normalizedDirectory = subdirectory.trim().replace(/^\/+|\/+$/g, '');
  return normalizedDirectory ? `${normalizedDirectory}/${fileName}` : fileName;
};

const sha256ChecksumForItem = (item: UploadQueueItem): string | undefined =>
  item.drsObject?.checksums.find((checksum) => checksum.type === 'sha256')
    ?.checksum;

const TRANSIENT_ALERT_TIMEOUT_MS = 5000;

interface GitUploadPRModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: (result: {
    branchName: string;
    pullRequestURL: string;
  }) => void;
  organization: string;
  project: string;
  targetSubdirectory: string;
  refs: Array<GeckoGitRef>;
  initialBaseBranch?: string;
  isRepositoryUninitialized?: boolean;
}

const GitUploadPRModal = ({
  opened,
  onClose,
  onSuccess,
  organization,
  project,
  targetSubdirectory,
  refs,
  initialBaseBranch,
  isRepositoryUninitialized = false,
}: GitUploadPRModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [baseBranch, setBaseBranch] = useState<string>(initialBaseBranch ?? '');
  const [hasAttemptedUpload, setHasAttemptedUpload] = useState(false);
  const [session, setSession] = useState<GeckoGitUploadSessionResponse | null>(
    null,
  );
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [isAttachingUploads, setIsAttachingUploads] = useState(false);
  const [hasAttachedUploads, setHasAttachedUploads] = useState(false);
  const {
    addFiles,
    clearFinishedItems,
    isUploading,
    queue,
    removeItem,
    startUpload,
    subdirectory,
  } = useUploadController({
    initialOrganization: organization,
    initialProject: project,
    initialSubdirectory: targetSubdirectory,
    lockOrganization: true,
    lockProject: true,
    lockSubdirectory: true,
  });
  const [createUploadSession] = useCreateGeckoGitUploadSessionMutation();
  const [attachSessionFiles] = useAttachGeckoGitUploadSessionFilesMutation();
  const [finalizeUploadSession, { isLoading: isFinalizing }] =
    useFinalizeGeckoGitUploadSessionMutation();

  useEffect(() => {
    if (!actionError) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setActionError(null);
    }, TRANSIENT_ALERT_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [actionError]);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setBaseBranch((current) => current || initialBaseBranch || refs[0]?.name || '');
  }, [initialBaseBranch, opened, refs]);

  const branchOptions = useMemo(
    () => {
      const options = refs
        .filter((ref) => ref.type === 'branch')
        .map((ref) => ({
          label: ref.default ? `${ref.name} (default)` : ref.name,
          value: ref.name,
        }));
      if (
        initialBaseBranch &&
        !options.some((option) => option.value === initialBaseBranch)
      ) {
        options.unshift({
          label: `${initialBaseBranch} (default)`,
          value: initialBaseBranch,
        });
      }
      return options;
    },
    [initialBaseBranch, refs],
  );

  const queuedItems = useMemo(
    () => queue.filter((item) => item.status === 'queued'),
    [queue],
  );

  const queueSummary = useMemo(
    () => ({
      count: queue.length,
      size: queue.reduce((sum, item) => sum + item.file.size, 0),
      queuedCount: queuedItems.length,
    }),
    [queue, queuedItems.length],
  );

  const completedUploads = useMemo(
    () =>
      queue.filter((item) => {
        if (item.status !== 'complete' || !item.drsObject?.id) {
          return false;
        }
        return !!sha256ChecksumForItem(item);
      }),
    [queue],
  );
  const uploadErrorMessages = useMemo(
    () =>
      queue
        .filter((item) => item.status === 'error' && item.error)
        .map((item) => ({
          id: item.id,
          fileName: item.file.name,
          message: item.error as string,
        })),
    [queue],
  );

  const hasUploadErrors = queue.some((item) => item.status === 'error');
  const hasAvailableBaseBranch = branchOptions.length > 0 || !!baseBranch;
  const canBeginUpload =
    !isRepositoryUninitialized &&
    !!baseBranch &&
    hasAvailableBaseBranch &&
    queuedItems.length > 0 &&
    !isPreparingSession &&
    !isUploading &&
    !isAttachingUploads &&
    !session;
  const canFinalize =
    !!session &&
    session.status === 'ready_for_pr' &&
    !session.has_conflicts &&
    !hasUploadErrors &&
    !isFinalizing;

  useEffect(() => {
    if (
      !session ||
      hasAttachedUploads ||
      session.has_conflicts ||
      isUploading ||
      isAttachingUploads
    ) {
      return;
    }

    const pendingTargets = session.files.filter((file) => !file.collision);
    if (pendingTargets.length === 0) {
      return;
    }

    const terminalItems = queue.filter(
      (item) => item.status === 'complete' || item.status === 'error',
    );
    if (terminalItems.length < pendingTargets.length) {
      return;
    }

    if (hasUploadErrors) {
      setActionError(
        'One or more Syfon uploads failed. Resolve those errors before creating the pull request.',
      );
      return;
    }

    const attachments = pendingTargets.flatMap((file) => {
      const uploadItem = completedUploads.find(
        (item) =>
          buildTargetPath(subdirectory, item.file.name) === file.target_path,
      );
      const checksum = uploadItem ? sha256ChecksumForItem(uploadItem) : undefined;
      if (!uploadItem?.drsObject?.id || !checksum) {
        return [];
      }
      return [
        {
          file_name: uploadItem.file.name,
          target_path: file.target_path,
          checksum,
          drs_object_id: uploadItem.drsObject.id,
          size: uploadItem.file.size,
        },
      ];
    });

    if (attachments.length !== pendingTargets.length) {
      setActionError(
        'Some uploaded files could not be matched to Syfon records. Try the upload again.',
      );
      return;
    }

    setIsAttachingUploads(true);
    void attachSessionFiles({
      organization,
      project,
      sessionID: session.session_id,
      body: { files: attachments },
    })
      .unwrap()
      .then((response) => {
        setSession(response);
        setPRFieldsFromSession(response);
        setHasAttachedUploads(true);
      })
      .catch((error: unknown) => {
        setActionError(
          error instanceof Error
            ? error.message
            : 'Failed to attach uploaded Syfon objects to the Git upload session.',
        );
      })
      .finally(() => {
        setIsAttachingUploads(false);
      });
  }, [
    attachSessionFiles,
    completedUploads,
    hasAttachedUploads,
    hasUploadErrors,
    isAttachingUploads,
    isUploading,
    organization,
    project,
    queue,
    session,
    subdirectory,
  ]);

  const setPRFieldsFromSession = (response: GeckoGitUploadSessionResponse) => {
    setPrTitle(response.pr_title);
    setPrBody(response.pr_body);
  };

  const handleStartUploadFlow = async () => {
    if (isRepositoryUninitialized) {
      setActionError(
        'This repository has no default branch yet. Initialize your repo first before uploading files.',
      );
      return;
    }
    if (!canBeginUpload || !baseBranch) {
      return;
    }
    setActionError(null);
    setHasAttemptedUpload(true);
    setIsPreparingSession(true);

    try {
      const response = await createUploadSession({
        organization,
        project,
        body: {
          base_branch: baseBranch,
          target_subdirectory: subdirectory,
          files: queuedItems.map((item) => ({
            name: item.file.name,
            size: item.file.size,
          })),
        },
      }).unwrap();

      setSession(response);
      setPRFieldsFromSession(response);

      if (response.has_conflicts) {
        setActionError(
          'Some target paths already exist on the selected base branch. Resolve those conflicts before uploading.',
        );
        return;
      }

      await startUpload();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Failed to create the Git upload session.',
      );
    } finally {
      setIsPreparingSession(false);
    }
  };

  const handleFinalize = async () => {
    if (!session) {
      return;
    }
    setActionError(null);
    try {
      const response = await finalizeUploadSession({
        organization,
        project,
        sessionID: session.session_id,
        body: {
          pr_title: prTitle.trim() || undefined,
          pr_body: prBody.trim() || undefined,
        },
      }).unwrap();
      setSession(response);
      setPRFieldsFromSession(response);
      if (response.pull_request_url) {
        onSuccess({
          branchName: response.branch_name,
          pullRequestURL: response.pull_request_url,
        });
        onClose();
      }
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Failed to create the GitHub pull request.',
      );
    }
  };

  const onFilesSelected = (files: FileList | null) => {
    if (!files) return;
    addFiles(Array.from(files));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onFilesSelected(event.dataTransfer.files);
  };

  return (
    <ProtectedContent>
      <Modal
        centered
        onClose={onClose}
        opened={opened}
        size="xl"
        title="Upload LFS files via pull request"
      >
        <Stack gap="md">
          <Alert color="blue" icon={<IconGitPullRequest size={16} />}>
            This flow uploads files to Syfon, commits Git LFS pointers on a new
            branch, and opens a GitHub pull request into the base branch you
            select. Nothing is pushed directly into <Code>main</Code>.
          </Alert>

          {actionError ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {actionError}
            </Alert>
          ) : null}

          {uploadErrorMessages.length > 0 ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              <Stack gap={4}>
                <Text fw={600} size="sm">
                  One or more Syfon uploads failed.
                </Text>
                {uploadErrorMessages.map((item) => (
                  <Text key={item.id} size="sm">
                    <strong>{item.fileName}:</strong> {item.message}
                  </Text>
                ))}
              </Stack>
            </Alert>
          ) : null}

          {!hasAvailableBaseBranch ? (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
              {isRepositoryUninitialized
                ? 'This repository has no default branch yet. Initialize your repo first before uploading files.'
                : 'Gecko has not loaded any repository branches yet. Refresh the repository first, then reopen this upload flow.'}
            </Alert>
          ) : null}

          <Group align="end" grow>
            <Select
              data={branchOptions}
              disabled={
                !hasAvailableBaseBranch ||
                isPreparingSession ||
                isUploading ||
                isAttachingUploads ||
                !!session
              }
              label="Base branch"
              onChange={(value) => setBaseBranch(value ?? '')}
              placeholder="Select a base branch"
              searchable={branchOptions.length > 6}
              value={baseBranch}
            />
            <div>
              <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                Target path
              </Text>
              <Text className="break-all" fw={600} size="sm">
                {subdirectory || '/'}
              </Text>
            </div>
          </Group>

          <div
            className="flex min-h-44 cursor-pointer flex-col items-center justify-center border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center"
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
            <IconUpload size={28} />
            <Text mt="sm" fw={600}>
              Drop LFS files here
            </Text>
            <Text c="dimmed" size="sm">
              Gecko will upload them to Syfon and create Git LFS pointers in a
              pull request.
            </Text>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(event) => onFilesSelected(event.target.files)}
            />
          </div>

          <Group justify="space-between">
            <Group gap="md">
              <Text c="dimmed" size="sm">
                {queueSummary.count} file{queueSummary.count === 1 ? '' : 's'}
              </Text>
              <Text c="dimmed" size="sm">
                {formatBytes(queueSummary.size)}
              </Text>
            </Group>
            <Group gap="sm">
              <Button
                disabled={isUploading || queue.length === 0}
                onClick={clearFinishedItems}
                variant="default"
              >
                Clear finished
              </Button>
                <Button
                  disabled={!canBeginUpload}
                  loading={isPreparingSession || isUploading}
                onClick={() => void handleStartUploadFlow()}
              >
                Upload files
              </Button>
            </Group>
          </Group>

          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File</Table.Th>
                <Table.Th>Target path</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Progress</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {queue.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" py="lg" ta="center">
                      Add one or more files to begin the LFS upload PR flow.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                queue.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <div>
                        <Text fw={600} size="sm">
                          {item.file.name}
                        </Text>
                        {item.error ? (
                          <Text c="red" size="xs">
                            {item.error}
                          </Text>
                        ) : null}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Code>{buildTargetPath(subdirectory, item.file.name)}</Code>
                    </Table.Td>
                    <Table.Td>{formatBytes(item.file.size)}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          item.status === 'complete'
                            ? 'green'
                            : item.status === 'error'
                              ? 'red'
                              : 'blue'
                        }
                        variant="light"
                      >
                        {item.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {item.status === 'queued' ? (
                        <Text c="dimmed" size="sm">
                          Waiting
                        </Text>
                      ) : (
                        <Stack gap={4}>
                          <Progress value={item.progress} />
                          <Text c="dimmed" size="xs">
                            {item.progress}% ({formatBytes(item.uploadedBytes)} /{' '}
                            {formatBytes(item.file.size)})
                          </Text>
                        </Stack>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        color="red"
                        disabled={isUploading || !!session}
                        onClick={() => void removeItem(item.id)}
                        size="compact-xs"
                        variant="subtle"
                      >
                        Remove
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>

          {session ? (
            <Stack gap="sm">
              <Group justify="space-between">
                <div>
                  <Text fw={700}>Review pull request</Text>
                  <Text c="dimmed" size="sm">
                    Gecko will create branch <Code>{session.branch_name}</Code>{' '}
                    from <Code>{session.base_branch}</Code>.
                  </Text>
                </div>
                {isAttachingUploads ? (
                  <Group gap={6}>
                    <Loader size="sm" />
                    <Text c="dimmed" size="sm">
                      Attaching Syfon uploads...
                    </Text>
                  </Group>
                ) : null}
              </Group>

              {session.has_conflicts ? (
                <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                  One or more target paths already exist on the selected base
                  branch. Fix the collisions before trying again.
                </Alert>
              ) : null}

              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Target path</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Error</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {session.files.map((file) => (
                    <Table.Tr key={file.target_path}>
                      <Table.Td>
                        <Code>{file.target_path}</Code>
                      </Table.Td>
                      <Table.Td>{file.status}</Table.Td>
                      <Table.Td>{file.error ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Textarea
                autosize
                disabled={!!session.pull_request_url}
                label="PR title"
                minRows={2}
                onChange={(event) => setPrTitle(event.currentTarget.value)}
                value={prTitle}
              />
              <Textarea
                autosize
                disabled={!!session.pull_request_url}
                label="PR body"
                minRows={4}
                onChange={(event) => setPrBody(event.currentTarget.value)}
                value={prBody}
              />

              <Group justify="flex-end">
                <Button
                  disabled={!canFinalize}
                  loading={isFinalizing}
                  onClick={() => void handleFinalize()}
                >
                  Create pull request
                </Button>
              </Group>
            </Stack>
          ) : null}
        </Stack>
      </Modal>
    </ProtectedContent>
  );
};

export default GitUploadPRModal;
