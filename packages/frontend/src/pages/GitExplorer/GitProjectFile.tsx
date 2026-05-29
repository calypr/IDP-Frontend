import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Alert,
  Badge,
  Breadcrumbs,
  Card,
  Code,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  SYFON_API,
  useGetGeckoGitProjectFileQuery,
  useGetGeckoGitProjectRefsQuery,
  useGetGeckoGitProjectStatusQuery,
  useGetSyfonObjectsByChecksumQuery,
  useLazyGetSyfonObjectsByChecksumQuery,
} from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout } from '../../features/Navigation';
import type { GitExplorerPageProps } from './types';

const formatBytes = (size: number): string => {
  if (!Number.isFinite(size) || size < 0) {
    return 'Unknown size';
  }
  if (size < 1024) {
    return `${size} bytes`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const buildSyfonDownloadUrl = (objectId: string): string =>
  `${SYFON_API}/download/${encodeURIComponent(objectId)}?redirect=true`;

const GitProjectFilePage = ({
  headerProps,
  footerProps,
}: GitExplorerPageProps) => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const pathSegments = Array.isArray(router.query.path)
    ? router.query.path
    : typeof router.query.path === 'string'
      ? [router.query.path]
      : [];
  const filePath = pathSegments.join('/');
  const requestedRef =
    typeof router.query.ref === 'string' ? router.query.ref : null;

  const [selectedRef, setSelectedRef] = useState<string | null>(requestedRef);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingChecksum, setDownloadingChecksum] = useState<string | null>(
    null,
  );
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const shouldSkip = !organization || !project || !filePath;
  const {
    data: projectStatus,
    isLoading: isStatusLoading,
  } = useGetGeckoGitProjectStatusQuery(
    { organization, project },
    { skip: !organization || !project },
  );
  const effectiveRef =
    selectedRef ?? requestedRef ?? projectStatus?.default_branch ?? null;
  const {
    data: refsData,
    isLoading: areRefsLoading,
  } = useGetGeckoGitProjectRefsQuery(
    { organization, project },
    {
      skip: !organization || !project,
    },
  );
  const {
    data: fileData,
    isLoading: isFileLoading,
  } = useGetGeckoGitProjectFileQuery(
    {
      organization,
      project,
      path: filePath,
      ref: effectiveRef ?? undefined,
    },
    {
      skip:
        shouldSkip ||
        projectStatus?.installation_state !== 'connected' ||
        !effectiveRef,
    },
  );
  const selectedFileLFSChecksum = fileData?.lfs_pointer?.oid;
  const {
    data: selectedFileSyfonObjects,
    isFetching: isFetchingSelectedFileSyfonObjects,
  } = useGetSyfonObjectsByChecksumQuery(selectedFileLFSChecksum ?? '', {
    skip: !selectedFileLFSChecksum,
  });
  const [lookupSyfonObjectsByChecksum] =
    useLazyGetSyfonObjectsByChecksumQuery();

  useEffect(() => {
    if (requestedRef) {
      setSelectedRef(requestedRef);
      return;
    }
    if (projectStatus?.default_branch && !selectedRef) {
      setSelectedRef(projectStatus.default_branch);
    }
  }, [projectStatus?.default_branch, requestedRef, selectedRef]);

  const refOptions = useMemo(
    () =>
      (refsData?.refs ?? []).map((ref) => ({
        label: ref.default ? `${ref.name} (default)` : ref.name,
        value: ref.name,
      })),
    [refsData?.refs],
  );

  const breadcrumbSegments = filePath.split('/').filter(Boolean);
  const parentPath = breadcrumbSegments.slice(0, -1).join('/');
  const selectedFileSyfonObject =
    selectedFileSyfonObjects?.resolved_drs_object?.[0];

  useEffect(() => {
    if (!fileData || fileData.lfs_pointer) {
      setPreviewContent(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }
    if (!fileData.download_url) {
      setPreviewContent(null);
      setPreviewError('No GitHub preview URL is available for this file.');
      setIsPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadPreview = async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const response = await fetch(fileData.download_url!, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`GitHub preview request failed with status ${response.status}`);
        }
        const text = await response.text();
        setPreviewContent(text);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewContent(null);
          setPreviewError(
            error instanceof Error
              ? error.message
              : 'Failed to load the GitHub file preview.',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => controller.abort();
  }, [fileData]);

  const handleLFSDownload = async (checksum: string) => {
    setActionError(null);
    setDownloadingChecksum(checksum);
    try {
      const response = await lookupSyfonObjectsByChecksum(checksum).unwrap();
      const objectId = response.resolved_drs_object?.[0]?.id;
      if (!objectId) {
        setActionError(
          `No Syfon object was found for LFS checksum ${checksum}.`,
        );
        return;
      }
      window.open(
        buildSyfonDownloadUrl(objectId),
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      setActionError(
        `Failed to resolve a Syfon download for LFS checksum ${checksum}.`,
      );
    } finally {
      setDownloadingChecksum(null);
    }
  };

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: `${organization}/${project}/${filePath}`,
        key: 'gecko-git-project-file',
        title: `${organization}/${project}/${filePath}`,
      }}
      mainProps={{ className: 'bg-[#f6f8fa]' }}
    >
      <ProtectedContent>
        <div className="min-h-screen bg-[#f6f8fa]">
          <Container py="md" size="xl">
            <Stack gap="sm">
              <Card padding="md" radius="md" withBorder>
                <Stack gap={4}>
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Link
                        href={`/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${selectedRef ? `?ref=${encodeURIComponent(selectedRef)}${parentPath ? `&path=${encodeURIComponent(parentPath)}` : ''}` : parentPath ? `?path=${encodeURIComponent(parentPath)}` : ''}`}
                        legacyBehavior
                      >
                        <a className="text-sm font-medium text-primary hover:underline">
                          Back to repository tree
                        </a>
                      </Link>
                      <Title className="mt-2 leading-tight" order={2}>
                        {breadcrumbSegments[breadcrumbSegments.length - 1] ||
                          filePath}
                      </Title>
                      <Text c="dimmed" size="sm">
                        Open a tracked file preview from the selected GitHub
                        ref.
                      </Text>
                    </div>
                  </Group>
                </Stack>
              </Card>

              {actionError ? (
                <Alert color="red" variant="light">
                  {actionError}
                </Alert>
              ) : null}

              <Card padding="md" radius="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-end">
                    <div>
                      <Text fw={700}>File details</Text>
                      <Text c="dimmed" size="sm">
                        Preview is loaded by the browser from GitHub for the
                        selected ref.
                      </Text>
                    </div>
                    <Select
                      data={refOptions}
                      disabled={areRefsLoading || refOptions.length === 0}
                      label="Ref"
                      onChange={(value) => {
                        const encodedPath = pathSegments
                          .map((segment) => encodeURIComponent(segment))
                          .join('/');
                        void router.push({
                          pathname: `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/blob/${encodedPath}`,
                          query: {
                            ...(value ? { ref: value } : {}),
                          },
                        });
                      }}
                      placeholder={
                        areRefsLoading ? 'Loading refs...' : 'Select a ref'
                      }
                      value={effectiveRef}
                      w={260}
                    />
                  </Group>

                  <Breadcrumbs>
                    <Link
                      href={`/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`}
                      legacyBehavior
                    >
                      <a>root</a>
                    </Link>
                    {breadcrumbSegments.map((segment, index) => (
                      <Text key={`${segment}-${index}`} size="sm">
                        {segment}
                      </Text>
                    ))}
                  </Breadcrumbs>

                  <Group gap="xs">
                    {fileData?.lfs_pointer ? (
                      <>
                        <Badge color="violet" variant="light">
                          Git LFS
                        </Badge>
                        <button
                          className="inline-flex items-center rounded-md border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={
                            isFetchingSelectedFileSyfonObjects ||
                            !selectedFileSyfonObject
                          }
                          onClick={() => {
                            if (selectedFileLFSChecksum) {
                              void handleLFSDownload(selectedFileLFSChecksum);
                            }
                          }}
                          type="button"
                        >
                          {downloadingChecksum === selectedFileLFSChecksum
                            ? 'Downloading...'
                            : isFetchingSelectedFileSyfonObjects
                              ? 'Resolving Syfon object...'
                              : 'Download LFS object'}
                        </button>
                      </>
                    ) : (
                      <Group gap="xs">
                        {fileData?.download_url ? (
                          <a
                            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            href={fileData.download_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Download file
                          </a>
                        ) : null}
                        {fileData?.html_url ? (
                          <a
                            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            href={fileData.html_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open on GitHub
                          </a>
                        ) : null}
                      </Group>
                    )}
                  </Group>

                  {fileData?.lfs_pointer ? (
                    <Alert color="violet" variant="light">
                      <Stack gap={4}>
                        <Text fw={600} size="sm">
                          Git LFS pointer detected
                        </Text>
                        <Text size="sm">
                          SHA256: <Code>{fileData.lfs_pointer.oid}</Code>
                        </Text>
                        <Text size="sm">
                          LFS object size: {formatBytes(fileData.lfs_pointer.size)}
                        </Text>
                        {!selectedFileSyfonObject &&
                        !isFetchingSelectedFileSyfonObjects ? (
                          <Text size="sm">
                            No Syfon object is currently resolved for this
                            checksum.
                          </Text>
                        ) : null}
                      </Stack>
                    </Alert>
                  ) : null}

                  {isStatusLoading || isFileLoading || isPreviewLoading ? (
                    <Loader size="sm" />
                  ) : fileData && previewContent !== null ? (
                    <>
                      <Card bg="#0b1020" c="white" padding="sm" radius="md">
                        <Code block color="transparent" c="white">
                          {previewContent}
                        </Code>
                      </Card>
                    </>
                  ) : previewError ? (
                    <Alert color="yellow" variant="light">
                      {previewError}
                    </Alert>
                  ) : (
                    <Text c="dimmed" size="sm">
                      File preview unavailable.
                    </Text>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Container>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitProjectFilePage;
