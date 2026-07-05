import React from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Progress,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  IconChevronRight,
  IconFile,
  IconFolder,
  IconRefresh,
  IconSelector,
} from '@tabler/icons-react';
import { formatBytes } from '../../utils/labels';
import type { FilesummaryConfig } from './types';
import type { StoragePathRow, StoragePathSummary } from './storageUtils';
import {
  formatTimestamp,
  type BreadcrumbItem,
  type StorageSortDirection,
  type StorageSortKey,
} from './storagePresentation';

type CollapsedBreadcrumb = {
  readonly leadingItems: Array<BreadcrumbItem>;
  readonly hiddenItems: Array<BreadcrumbItem>;
};

type StorageBrowserProps = {
  readonly auditReport?: React.ReactNode;
  readonly collapsedBreadcrumb: CollapsedBreadcrumb;
  readonly currentPath: string;
  readonly data: StoragePathSummary | null;
  readonly filesummaryConfig?: FilesummaryConfig;
  readonly isChainAuditing: boolean;
  readonly isLoadingMore: boolean;
  readonly largestRowSize: number;
  readonly pageTitle: string;
  readonly selectedProject: string;
  readonly sortedRows: Array<StoragePathRow>;
  readonly storageSortDirection: StorageSortDirection;
  readonly storageSortKey: StorageSortKey;
  readonly onLoadMore: () => void;
  readonly onRunAudit: () => void;
  readonly onPathChange: (path: string) => void;
  readonly onRefresh: () => void;
  readonly onSort: (key: StorageSortKey) => void;
};

export const StorageBrowser = ({
  auditReport,
  collapsedBreadcrumb,
  currentPath,
  data,
  filesummaryConfig,
  isChainAuditing,
  isLoadingMore,
  largestRowSize,
  onLoadMore,
  onRunAudit,
  onPathChange,
  onRefresh,
  onSort,
  pageTitle,
  selectedProject,
  sortedRows,
  storageSortKey,
}: StorageBrowserProps): JSX.Element => {
  const renderStorageSortHeader = (
    label: string,
    key: StorageSortKey,
  ): JSX.Element => (
    <button
      className="flex items-center gap-1 text-left font-semibold text-slate-900"
      onClick={() => onSort(key)}
      type="button"
    >
      <span>{label}</span>
      <IconSelector
        className={storageSortKey === key ? 'text-primary' : 'text-slate-400'}
        size={14}
      />
    </button>
  );
  const formatOptionalCount = (value?: number): string =>
    typeof value === 'number' ? value.toLocaleString() : '-';

  return (
    <Stack gap="md" px="sm">
      <div className="overflow-x-auto">
        <div className="flex min-w-[1320px] items-center justify-between gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap overflow-x-auto pb-1">
            {collapsedBreadcrumb.leadingItems.map((item, index) => (
              <React.Fragment key={item.path || item.label}>
                {index > 0 ? (
                  <IconChevronRight
                    className="shrink-0 text-slate-400"
                    size={14}
                  />
                ) : null}
                {index === 1 && collapsedBreadcrumb.hiddenItems.length > 0 ? (
                  <>
                    <Menu shadow="md" width={260} withinPortal>
                      <Menu.Target>
                        <button
                          className="max-w-[220px] shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          type="button"
                        >
                          ...
                        </button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {collapsedBreadcrumb.hiddenItems.map((hiddenItem) => (
                          <Menu.Item
                            key={hiddenItem.path}
                            onClick={() => onPathChange(hiddenItem.path)}
                          >
                            {hiddenItem.label}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                    <IconChevronRight
                      className="shrink-0 text-slate-400"
                      size={14}
                    />
                  </>
                ) : null}
                <button
                  className={`max-w-[240px] truncate rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                    item.path === currentPath
                      ? 'border-slate-200 bg-slate-100 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                  onClick={() => onPathChange(item.path)}
                  title={item.label}
                  type="button"
                >
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>
          <Group
            align="center"
            className="shrink-0 justify-self-end"
            gap="xs"
            wrap="nowrap"
          >
            <Button
              loading={isChainAuditing}
              onClick={onRunAudit}
              size="xs"
              variant="light"
            >
              Audit exacts
            </Button>
            <ActionIcon
              aria-label="Refresh metrics"
              disabled={!selectedProject}
              onClick={onRefresh}
              size="lg"
              variant="subtle"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </div>
      </div>

      {auditReport}

      <div className="overflow-x-auto">
        <div className="grid min-w-[1320px] grid-cols-[260px_140px_180px_120px_220px] items-end gap-x-8">
          <div className="min-w-[220px]">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Project
            </Text>
            <Text
              className="mt-1 truncate"
              fw={700}
              size="sm"
              title={pageTitle}
            >
              {pageTitle}
            </Text>
          </div>

          <div className="min-w-[140px]">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Size
            </Text>
            <Text className="mt-1" fw={700} size="sm">
              {formatBytes(data?.sizeBytes ?? 0)}
            </Text>
          </div>

          <div className="min-w-[140px]">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Files
            </Text>
            <Text className="mt-1" fw={700} size="sm">
              {(data?.fileCount ?? 0).toLocaleString()}
              {' · '}
              {data?.childCount ?? 0} children
            </Text>
            {data?.isChainAuditExact ? (
              <Text c="dimmed" className="mt-1 truncate" size="xs">
                <Badge color="green" mr={6} size="xs" variant="light">
                  Verified
                </Badge>
                <span>
                  {(data.recordCount ?? 0).toLocaleString()} Syfon records
                  {typeof data.bucketObjectCount === 'number'
                    ? ` · ${data.bucketObjectCount.toLocaleString()} bucket objects`
                    : ''}
                </span>
              </Text>
            ) : null}
          </div>

          <div className="min-w-[120px]">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Downloads
            </Text>
            <Text className="mt-1" fw={700} size="sm">
              {formatOptionalCount(data?.downloadCount)}
            </Text>
          </div>

          <div className="min-w-[200px]">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Last Download
            </Text>
            <Text
              className="mt-1 truncate"
              fw={700}
              size="sm"
              title={formatTimestamp(data?.lastDownload)}
            >
              {formatTimestamp(data?.lastDownload)}
            </Text>
          </div>
        </div>
      </div>

      <Stack gap="sm" pt="sm">
        <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{renderStorageSortHeader('Name', 'name')}</Table.Th>
              <Table.Th>{renderStorageSortHeader('Type', 'type')}</Table.Th>
              <Table.Th>
                {renderStorageSortHeader('Size', 'sizeBytes')}
              </Table.Th>
              <Table.Th>
                {renderStorageSortHeader('Files', 'fileCount')}
              </Table.Th>
              <Table.Th>
                {renderStorageSortHeader('Downloads', 'downloadCount')}
              </Table.Th>
              <Table.Th>
                {renderStorageSortHeader('Last Download', 'lastDownload')}
              </Table.Th>
              <Table.Th>
                {renderStorageSortHeader('Latest Update', 'lastUpdated')}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedRows.length ? (
              sortedRows.map((row) => {
                const relativeWidth =
                  largestRowSize > 0
                    ? Math.max(
                        4,
                        Math.round((row.sizeBytes / largestRowSize) * 100),
                      )
                    : 0;

                return (
                  <Table.Tr key={`${row.type}:${row.path}`}>
                    <Table.Td>
                      {row.type === 'directory' ? (
                        <button
                          className="flex w-full items-start gap-2 text-left text-primary hover:underline"
                          onClick={() => onPathChange(row.path)}
                          type="button"
                        >
                          <IconFolder className="mt-0.5" size={16} />
                          <div className="min-w-0">
                            <span className="break-all">{row.name}</span>
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-start gap-2">
                          <IconFile className="mt-0.5" size={16} />
                          <div className="min-w-0">
                            <span className="break-all">{row.name}</span>
                          </div>
                        </div>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={row.type === 'directory' ? 'blue' : 'gray'}
                        variant="light"
                      >
                        {row.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td miw={220}>
                      <Stack gap={6}>
                        <Text fw={600} size="sm">
                          {formatBytes(row.sizeBytes)}
                        </Text>
                        <Progress
                          color={filesummaryConfig?.barChartColor || 'blue'}
                          radius="xl"
                          size="sm"
                          value={relativeWidth}
                        />
                      </Stack>
                    </Table.Td>
                    <Table.Td>{row.fileCount.toLocaleString()}</Table.Td>
                    <Table.Td>{formatOptionalCount(row.downloadCount)}</Table.Td>
                    <Table.Td>{formatTimestamp(row.lastDownload)}</Table.Td>
                    <Table.Td>{formatTimestamp(row.lastUpdated)}</Table.Td>
                  </Table.Tr>
                );
              })
            ) : (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" py="xl" ta="center">
                    No files or directories were returned for this path.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
        {data?.hasMore ? (
          <Group justify="center">
            <Button
              loading={isLoadingMore}
              onClick={onLoadMore}
              size="xs"
              variant="outline"
            >
              Load more
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Stack>
  );
};
