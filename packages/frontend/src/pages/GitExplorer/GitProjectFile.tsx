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
  type GeckoGitLFSPointerInfo,
  SYFON_API,
  useGetGeckoGitProjectFileQuery,
  useGetGeckoGitProjectsQuery,
  useGetGeckoGitProjectRefsQuery,
  mintSyfonObjectIdFromChecksum,
} from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout } from '../../features/Navigation';
import { useIsEmbedded } from '../../utils';
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

const parseGitLFSPointer = (
  content: string,
): GeckoGitLFSPointerInfo | null => {
  const normalizedContent = content.trim();
  const match = normalizedContent.match(
    /^version https:\/\/git-lfs\.github\.com\/spec\/v1\s+oid sha256:([a-f0-9]{64})\s+size (\d+)\s*$/i,
  );
  if (!match) {
    return null;
  }

  const size = Number(match[2]);
  if (!Number.isFinite(size) || size < 0) {
    return null;
  }

  return {
    version: 'https://git-lfs.github.com/spec/v1',
    oid: match[1].toLowerCase(),
    size,
  };
};

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
  const isEmbedded = useIsEmbedded();
  const requestedRef =
    typeof router.query.ref === 'string' ? router.query.ref : null;

  const [selectedRef, setSelectedRef] = useState<string | null>(requestedRef);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [detectedLFSPointer, setDetectedLFSPointer] =
    useState<GeckoGitLFSPointerInfo | null>(null);

  const shouldSkip = !organization || !project || !filePath;
  const {
    data: gitProjects = [],
    isLoading: isStatusLoading,
  } = useGetGeckoGitProjectsQuery();
  const projectStatus = useMemo(
    () =>
      gitProjects.find(
        (candidate) =>
          candidate.organization === organization && candidate.project === project,
      ),
    [gitProjects, organization, project],
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
  const effectiveLFSPointer = fileData?.lfs_pointer ?? detectedLFSPointer;
  const selectedFileLFSChecksum = effectiveLFSPointer?.oid;
  const [drsDownloadUrl, setDrsDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFileLFSChecksum || !organization || !project) {
      setDrsDownloadUrl(null);
      return;
    }
    let cancelled = false;
    const resolveDrsUrl = async () => {
      try {
        const objectId = await mintSyfonObjectIdFromChecksum(
          selectedFileLFSChecksum,
          [`/programs/${organization}/projects/${project}`],
        );
        if (!cancelled) {
          setDrsDownloadUrl(
            `${SYFON_API}/download/${encodeURIComponent(objectId)}?redirect=true`,
          );
        }
      } catch (err) {
        console.error('Failed to mint DRS object ID', err);
        if (!cancelled) {
          setDrsDownloadUrl(null);
        }
      }
    };
    void resolveDrsUrl();

    return () => {
      cancelled = true;
    };
  }, [selectedFileLFSChecksum, organization, project]);

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

  useEffect(() => {
    if (!fileData || fileData.lfs_pointer) {
      setDetectedLFSPointer(fileData?.lfs_pointer ?? null);
      setPreviewContent(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }
    setDetectedLFSPointer(null);
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
        const parsedLFSPointer = parseGitLFSPointer(text);
        if (parsedLFSPointer) {
          setDetectedLFSPointer(parsedLFSPointer);
          setPreviewContent(null);
          setPreviewError(null);
          return;
        }
        setDetectedLFSPointer(null);
        setPreviewContent(text);
      } catch (error) {
        if (!controller.signal.aborted) {
          setDetectedLFSPointer(null);
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

  const gitProjectFileContent = (
    <div className="min-h-screen bg-[#f6f8fa]">
      <Container py="md" size="xl">
        <Stack gap="sm">
          <Card padding="md" radius="md" withBorder>
            <Stack gap={4}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Link
                    href={`/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${selectedRef ? `?ref=${encodeURIComponent(selectedRef)}${parentPath ? `&path=${encodeURIComponent(parentPath)}` : ''}` : parentPath ? `?path=${encodeURIComponent(parentPath)}` : ''}`}
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
                    {effectiveLFSPointer
                      ? 'Git LFS files download through Syfon instead of opening the GitHub pointer.'
                      : 'Preview is loaded by the browser from GitHub for the selected ref.'}
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
                      pathname: `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/blob/${encodedPath}`,
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
                  href={`/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`}
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
                {effectiveLFSPointer ? (
                  <Badge color="violet" variant="light">
                    Git LFS
                  </Badge>
                ) : null}

                {fileData?.download_url || effectiveLFSPointer ? (
                  <button
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!!effectiveLFSPointer && !drsDownloadUrl}
                    onClick={() => {
                      if (effectiveLFSPointer) {
                        if (drsDownloadUrl) {
                          window.open(drsDownloadUrl, '_blank', 'noopener,noreferrer');
                        }
                      } else if (fileData?.download_url) {
                        window.open(fileData.download_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    type="button"
                  >
                    Download file
                  </button>
                ) : null}

                {fileData?.html_url && !effectiveLFSPointer ? (
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

              {effectiveLFSPointer ? (
                <Alert color="violet" variant="light">
                  <Stack gap={4}>
                    <Text fw={600} size="sm">
                      Git LFS pointer detected
                    </Text>
                    <Text size="sm">
                      SHA256: <Code>{effectiveLFSPointer.oid}</Code>
                    </Text>
                    <Text size="sm">
                      LFS object size: {formatBytes(effectiveLFSPointer.size)}
                    </Text>
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
  );

  if (isEmbedded) {
    return <ProtectedContent>{gitProjectFileContent}</ProtectedContent>;
  }

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
      <ProtectedContent>{gitProjectFileContent}</ProtectedContent>
    </NavPageLayout>
  );
};

export default GitProjectFilePage;
