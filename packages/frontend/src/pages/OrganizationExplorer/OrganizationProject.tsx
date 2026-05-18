import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Container,
  Group,
  Menu,
  Modal,
  Popover,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconChevronRight,
  IconDownload,
  IconFile,
  IconFolder,
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconSearch,
  IconTerminal2,
  IconPhoto,
  IconX,
} from '@tabler/icons-react';
import {
  type SyfonIndexRecord,
  useGetSyfonIndexRecordsQuery,
} from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { Upload } from '../../features/Upload';
import { NavPageLayout } from '../../features/Navigation';
import type { FileActionsConfig } from '../../features/CohortBuilder/types';
import type {
  OrganizationExplorerPageProps,
  RepoListingEntry,
  SyfonRepoFile,
} from './types';
import {
  buildRepoListingEntries,
  getSyfonRepoDownloadUrl,
  normalizeSyfonIndexRecordToRepoFile,
  parsePathQueryValue,
  truncateDescription,
} from './utils';

const formatBytes = (size?: number): string => {
  if (typeof size !== 'number' || Number.isNaN(size)) return '—';
  if (size === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatTimestamp = (value?: string): string => {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const getFileExtension = (fileName: string): string =>
  fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';

const getConfiguredActions = (
  file: SyfonRepoFile,
  fileActions?: FileActionsConfig,
): Array<string> => {
  const extension = getFileExtension(file.displayName);
  const configured =
    fileActions?.extensions?.[extension] ??
    fileActions?.extensions?.default ??
    ['file_download'];

  return configured.includes('file_download')
    ? configured
    : ['file_download', ...configured];
};

const openDownload = (did: string) => {
  window.open(getSyfonRepoDownloadUrl(did), '_blank', 'noopener,noreferrer');
};

const openImageViewer = (did: string, fileActions?: FileActionsConfig) => {
  const baseUrl = fileActions?.actions?.file_image || '/image-viewer/view';
  const target = baseUrl.endsWith('/') ? `${baseUrl}${did}` : `${baseUrl}/${did}`;
  window.open(target, '_blank', 'noopener,noreferrer');
};

const buildGitDrsRemoteAddCommand = (
  organization: string,
  project: string,
): string =>
  `git drs remote add gen3 origin ${organization}/${project} --cred ~/.gen3/credentials.json`;

const FileDetailsPanel = ({
  file,
  fileActions,
  onBack,
}: {
  file: SyfonRepoFile;
  fileActions?: FileActionsConfig;
  onBack: () => void;
}) => {
  const configuredActions = getConfiguredActions(file, fileActions);
  const primaryUrl = file.accessMethods[0]?.access_url?.url;
  const shouldShowRepoPath =
    file.canonicalFilename.trim() !== file.displayName.trim();

  return (
    <Card padding="xl" radius="xl" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              File Details
            </Text>
            <Title className="mt-2 break-all" order={2}>
              {file.displayName}
            </Title>
            {shouldShowRepoPath && (
              <Text c="dimmed" className="mt-1 break-all" size="sm">
                {file.canonicalFilename}
              </Text>
            )}
          </div>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
            size="sm"
            variant="light"
          >
            Back to files
          </Button>
        </Group>

        <Group gap="xs">
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={() => openDownload(file.did)}
            size="sm"
          >
            Download
          </Button>
          {configuredActions.includes('file_image') && (
            <ActionIcon
              aria-label={`Open image viewer for ${file.displayName}`}
              color="teal"
              onClick={() => openImageViewer(file.did, fileActions)}
              size="lg"
              variant="light"
            >
              <IconPhoto size={18} />
            </ActionIcon>
          )}
        </Group>

        <div className="space-y-3 text-sm">
          <div>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              DID
            </Text>
            <Text className="break-all">{file.did}</Text>
          </div>
          {shouldShowRepoPath && (
            <div>
              <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                Repository Path
              </Text>
              <Text className="break-all">{file.canonicalFilename}</Text>
            </div>
          )}
          <div>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Size
            </Text>
            <Text>{formatBytes(file.size)}</Text>
          </div>
          <div>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Updated
            </Text>
            <Text>{formatTimestamp(file.updatedTime ?? file.createdTime)}</Text>
          </div>
          {file.description && (
            <div>
              <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                Description
              </Text>
              <Text>{file.description}</Text>
            </div>
          )}
          {primaryUrl && (
            <div>
              <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                Source URL
              </Text>
              <Text className="break-all">{primaryUrl}</Text>
            </div>
          )}
          <div>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Controlled Access
            </Text>
            <Stack gap={4} mt={6}>
              {file.controlledAccess.length > 0 ? (
                file.controlledAccess.map((scope) => (
                  <Badge key={scope} radius="sm" variant="light">
                    {scope}
                  </Badge>
                ))
              ) : (
                <Text size="sm">—</Text>
              )}
            </Stack>
          </div>
          <div>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Checksums
            </Text>
            <Stack gap={4} mt={6}>
              {Object.entries(file.checksums).length > 0 ? (
                Object.entries(file.checksums).map(([type, checksum]) => (
                  <Text className="break-all" key={type} size="sm">
                    <strong>{type}:</strong> {checksum}
                  </Text>
                ))
              ) : (
                <Text size="sm">—</Text>
              )}
            </Stack>
          </div>
        </div>
      </Stack>
    </Card>
  );
};

const OrganizationProjectPage = ({
  headerProps,
  footerProps,
  fileActions,
}: OrganizationExplorerPageProps) => {
  const router = useRouter();
  const organization = typeof router.query.org === 'string' ? router.query.org : '';
  const project = typeof router.query.project === 'string' ? router.query.project : '';
  const currentPath = useMemo(
    () => parsePathQueryValue(router.query.path),
    [router.query.path],
  );
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [hasCopiedRemoteCommand, setHasCopiedRemoteCommand] = useState(false);
  const [hasCopiedRepoPath, setHasCopiedRepoPath] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pageScrollTopRef = useRef(0);

  const { data: records = [], isFetching, isLoading } = useGetSyfonIndexRecordsQuery(
    {
      limit: 1000,
      organization,
      project,
    },
    {
      skip: !organization || !project,
    },
  );

  // The current repo view derives its directory structure client-side from the
  // full project record set. That keeps the UI functional without a Syfon-owned
  // hierarchy API, but it also means large projects can put noticeable memory
  // and CPU pressure on older or slower machines.
  const repoFiles = useMemo(
    () =>
      records.map((record: SyfonIndexRecord) =>
        normalizeSyfonIndexRecordToRepoFile(record),
      ),
    [records],
  );
  const listingEntries = useMemo(
    () => buildRepoListingEntries(repoFiles, currentPath),
    [currentPath, repoFiles],
  );
  const selectedFile = useMemo(
    () =>
      repoFiles.find((file: SyfonRepoFile) => file.did === selectedDid) ?? null,
    [repoFiles, selectedDid],
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) return [];

    return repoFiles
      .filter((file) => {
        const haystacks = [
          file.displayName,
          file.canonicalFilename,
          file.pathSegments.join('/'),
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        return haystacks.some((value) => value.includes(normalizedSearchQuery));
      })
      .slice(0, 12);
  }, [normalizedSearchQuery, repoFiles]);
  const currentRepoPath = [organization, project, ...currentPath].join('/');
  const isSearchOpen = normalizedSearchQuery.length > 0;

  useEffect(() => {
    const fileFromQuery =
      typeof router.query.file === 'string' ? router.query.file : null;
    setSelectedDid(fileFromQuery);
  }, [organization, project, router.query.file, router.query.path]);

  useEffect(() => {
    if (selectedDid === null) {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedDid]);

  const navigateToPath = (pathSegments: Array<string>) => {
    const nextQuery: Record<string, string> = {
      org: organization,
      project,
    };

    if (pathSegments.length > 0) {
      nextQuery.path = pathSegments.join('/');
    }

    void router.push(
      {
        pathname: '/organization/[org]/project/[project]',
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  };

  const handleEntryClick = (entry: RepoListingEntry) => {
    if (entry.type === 'directory') {
      navigateToPath(entry.pathSegments);
      return;
    }

    pageScrollTopRef.current = window.scrollY;
    setSelectedDid(entry.file.did);
  };

  const handleBackToFiles = () => {
    if (typeof router.query.file === 'string') {
      const nextQuery: Record<string, string> = {
        org: organization,
        project,
      };

      if (currentPath.length > 0) {
        nextQuery.path = currentPath.join('/');
      }

      void router.push(
        {
          pathname: '/organization/[org]/project/[project]',
          query: nextQuery,
        },
        undefined,
        { shallow: true },
      );
    }

    setSelectedDid(null);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: pageScrollTopRef.current, behavior: 'auto' });
    });
  };

  const breadcrumbSegments = currentPath.map((segment, index) => ({
    label: segment,
    pathSegments: currentPath.slice(0, index + 1),
  }));
  const gitDrsRemoteAddCommand = buildGitDrsRemoteAddCommand(
    organization,
    project,
  );

  const repoRootLabel = {
    label: project,
    pathSegments: [] as Array<string>,
  };

  const breadcrumbLabelClassName =
    'truncate text-[1.1rem] font-semibold leading-tight text-slate-900 hover:text-slate-950';

  const renderBreadcrumbButton = (
    label: string,
    pathSegments: Array<string>,
  ) => (
    <button
      className={`${breadcrumbLabelClassName} max-w-[220px]`}
      onClick={() => navigateToPath(pathSegments)}
      type="button"
    >
      {label}
    </button>
  );

  const copyGitDrsRemoteAddCommand = async () => {
    await navigator.clipboard.writeText(gitDrsRemoteAddCommand);
    setHasCopiedRemoteCommand(true);
    window.setTimeout(() => setHasCopiedRemoteCommand(false), 2000);
  };

  const copyCurrentRepoPath = async () => {
    await navigator.clipboard.writeText(currentRepoPath);
    setHasCopiedRepoPath(true);
    window.setTimeout(() => setHasCopiedRepoPath(false), 2000);
  };

  const openSearchResult = (file: SyfonRepoFile) => {
    const parentPath = file.pathSegments.slice(0, -1);
    const nextQuery: Record<string, string> = {
      org: organization,
      project,
      file: file.did,
    };

    if (parentPath.length > 0) {
      nextQuery.path = parentPath.join('/');
    }

    pageScrollTopRef.current = window.scrollY;
    setSearchQuery('');
    void router.push(
      {
        pathname: '/organization/[org]/project/[project]',
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  };

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: `${organization}/${project}`,
        key: 'syfon-organization-project',
        title: `${organization}/${project}`,
      }}
    >
      <ProtectedContent>
        <div className="min-h-screen bg-[#f6f8fa]">
          <Container py="md" size="xl">
            <Stack gap="sm">
              <Card padding="md" radius="md" withBorder>
                <Stack gap={4}>
                  <Group align="center" className="min-h-[2.25rem]" justify="space-between" wrap="nowrap">
                    <Group className="min-w-0 flex-1" gap={6} wrap="nowrap">
                      <Link href={`/organization/${encodeURIComponent(organization)}`} legacyBehavior>
                        <a className="min-w-0 no-underline text-primary hover:underline">
                          <Title className="truncate text-[1.1rem] leading-tight" order={3}>
                            {organization}
                          </Title>
                        </a>
                      </Link>
                      <Text c="dimmed" fw={700} size="sm">
                        /
                      </Text>
                      {renderBreadcrumbButton(
                        repoRootLabel.label,
                        repoRootLabel.pathSegments,
                      )}
                      {breadcrumbSegments.map((segment) => (
                        <React.Fragment key={segment.pathSegments.join('/')}>
                          <Text c="dimmed" fw={700} size="sm">
                            /
                          </Text>
                          {renderBreadcrumbButton(
                            segment.label,
                            segment.pathSegments,
                          )}
                        </React.Fragment>
                      ))}
                      <ActionIcon
                        aria-label="Copy repository path"
                        color={hasCopiedRepoPath ? 'primary.0' : 'gray'}
                        onClick={() => {
                          void copyCurrentRepoPath();
                        }}
                        size="sm"
                        variant="subtle"
                      >
                        {hasCopiedRepoPath ? (
                          <IconCheck size={16} />
                        ) : (
                          <IconCopy size={16} />
                        )}
                      </ActionIcon>
                    </Group>
                    <Group gap={8} wrap="nowrap">
                      <Popover
                        opened={isSearchOpen}
                        position="bottom-end"
                        shadow="md"
                        width={360}
                        withinPortal
                      >
                        <Popover.Target>
                          <TextInput
                            className="w-[18rem]"
                            leftSection={<IconSearch size={16} />}
                            onChange={(event) => setSearchQuery(event.currentTarget.value)}
                            placeholder="Go to file"
                            rightSection={
                              searchQuery ? (
                                <ActionIcon
                                  aria-label="Clear file search"
                                  onClick={() => setSearchQuery('')}
                                  size="sm"
                                  variant="subtle"
                                >
                                  <IconX size={14} />
                                </ActionIcon>
                              ) : null
                            }
                            size="sm"
                            value={searchQuery}
                          />
                        </Popover.Target>
                        <Popover.Dropdown p={0}>
                          <div className="max-h-[26rem] overflow-y-auto py-2">
                            {searchResults.length > 0 ? (
                              searchResults.map((file) => (
                                <button
                                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-slate-50"
                                  key={file.did}
                                  onClick={() => openSearchResult(file)}
                                  type="button"
                                >
                                  <IconFile className="mt-0.5 text-slate-500" size={16} />
                                  <div className="min-w-0">
                                    <Text fw={600} size="sm">
                                      {file.displayName}
                                    </Text>
                                    <Text c="dimmed" className="truncate" size="xs">
                                      {file.canonicalFilename}
                                    </Text>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <Text c="dimmed" className="px-3 py-3" size="sm">
                                No files match “{searchQuery}”.
                              </Text>
                            )}
                          </div>
                        </Popover.Dropdown>
                      </Popover>
                      <Button
                        className="px-2"
                        onClick={() => setIsUploadOpen(true)}
                        size="xs"
                        variant="default"
                      >
                        Upload files
                      </Button>
                      <Menu position="bottom-end" shadow="md" width={420} withinPortal>
                        <Menu.Target>
                          <Button
                            className="px-2"
                            leftSection={<IconTerminal2 size={16} />}
                            rightSection={<IconChevronDown size={14} />}
                            size="xs"
                            variant="default"
                          >
                            Remote add
                          </Button>
                        </Menu.Target>

                        <Menu.Dropdown>
                          <div className="space-y-2 px-3 py-2">
                            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                              Git-DRS Remote
                            </Text>
                            <Code
                              block
                              className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-slate-200 bg-slate-50 p-2 text-[12px]"
                            >
                              {gitDrsRemoteAddCommand}
                            </Code>
                            <Group justify="space-between" wrap="nowrap">
                              <Text c="dimmed" size="xs">
                                Run this inside an existing clone.
                              </Text>
                              <Button
                                className="px-2"
                                leftSection={
                                  hasCopiedRemoteCommand ? (
                                    <IconCheck size={14} />
                                  ) : (
                                    <IconCopy size={14} />
                                  )
                                }
                                onClick={() => {
                                  void copyGitDrsRemoteAddCommand();
                                }}
                                size="xs"
                                variant={hasCopiedRemoteCommand ? 'light' : 'default'}
                              >
                                {hasCopiedRemoteCommand ? 'Copied' : 'Copy'}
                              </Button>
                            </Group>
                          </div>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>

                </Stack>
              </Card>

              <Modal
                centered
                onClose={() => setIsUploadOpen(false)}
                opened={isUploadOpen}
                size="xl"
                title="Upload files"
              >
                <Upload
                  embedded
                  hideScopeControls
                  initialOrganization={organization}
                  initialProject={project}
                  initialSubdirectory={currentPath.join('/')}
                  lockOrganization
                  lockProject
                  lockSubdirectory
                />
              </Modal>

              {selectedFile ? (
                <FileDetailsPanel
                  file={selectedFile}
                  fileActions={fileActions}
                  onBack={handleBackToFiles}
                />
              ) : (
                <Card padding={0} radius="md" withBorder>
                  <ScrollArea>
                    <Table highlightOnHover stickyHeader>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th className="pl-3 pr-4 py-2 text-xs">Name</Table.Th>
                          <Table.Th className="px-4 py-2 text-xs">Description</Table.Th>
                          <Table.Th className="px-4 py-2 text-xs" w={120}>
                            Size
                          </Table.Th>
                          <Table.Th className="px-4 py-2 text-xs" w={180}>
                            Updated
                          </Table.Th>
                          <Table.Th className="pl-4 pr-3 py-2 text-xs" ta="right" w={72}>
                            Actions
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {listingEntries.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={5}>
                              <Text c="dimmed" py="xl" ta="center">
                                {isLoading || isFetching
                                  ? 'Loading project files...'
                                  : 'No files found for this folder.'}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {listingEntries.map((entry) => (
                          <Table.Tr
                            key={
                              entry.type === 'directory'
                                ? `dir-${entry.pathSegments.join('/')}`
                                : entry.file.did
                            }
                            className={
                              entry.type === 'file' && entry.file.did === selectedDid
                                ? 'cursor-pointer bg-sky-50'
                                : 'cursor-pointer'
                            }
                            onClick={() => handleEntryClick(entry)}
                          >
                            <Table.Td className="pl-3 pr-4 py-1">
                              <div className="flex w-full items-center gap-2.5 px-1.5 py-1">
                                {entry.type === 'directory' ? (
                                  <IconFolder className="text-sky-600" size={16} />
                                ) : (
                                  <IconFile className="text-slate-500" size={16} />
                                )}
                                <div>
                                  <Text fw={600} size="sm">
                                    {entry.name}
                                  </Text>
                                  {entry.type === 'directory' && (
                                    <Text c="dimmed" size="xs">
                                      {entry.itemCount} nested
                                      {entry.itemCount === 1 ? ' item' : ' items'}
                                    </Text>
                                  )}
                                </div>
                              </div>
                            </Table.Td>
                            <Table.Td className="px-4 py-1">
                              <Text c="dimmed" size="sm">
                                {entry.type === 'directory'
                                  ? 'Derived folder'
                                  : truncateDescription(entry.file.description) ?? '—'}
                              </Text>
                            </Table.Td>
                            <Table.Td className="px-4 py-1">
                              <Text size="sm">
                                {entry.type === 'directory'
                                  ? '—'
                                  : formatBytes(entry.file.size)}
                              </Text>
                            </Table.Td>
                            <Table.Td className="px-4 py-1">
                              <Text size="sm">
                                {entry.type === 'directory'
                                  ? '—'
                                  : formatTimestamp(
                                      entry.file.updatedTime ?? entry.file.createdTime,
                                    )}
                              </Text>
                            </Table.Td>
                            <Table.Td className="pl-4 pr-3 py-1">
                              <Group justify="flex-end">
                                {entry.type === 'file' ? (
                                  <ActionIcon
                                    aria-label={`Download ${entry.file.displayName}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openDownload(entry.file.did);
                                    }}
                                    size="md"
                                    variant="subtle"
                                  >
                                    <IconDownload size={16} />
                                  </ActionIcon>
                                ) : (
                                  <Text c="dimmed" size="sm">
                                    —
                                  </Text>
                                )}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Card>
              )}
            </Stack>
          </Container>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default OrganizationProjectPage;
