import React from 'react';
import {
  Badge,
  Button,
  Group,
  Progress,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  IconFile,
  IconFolder,
  IconSelector,
} from '@tabler/icons-react';
import { formatBytes } from '../../utils/labels';
import type { FilesummaryConfig } from './types';
import type { StoragePathRow, StoragePathSummary } from './storageUtils';
import {
  formatTimestamp,
  type StorageSortDirection,
  type StorageSortKey,
} from './storagePresentation';

type StorageBrowserProps = {
  readonly data: StoragePathSummary | null;
  readonly filesummaryConfig?: FilesummaryConfig;
  readonly isLoadingMore: boolean;
  readonly largestRowSize: number;
  readonly sortedRows: Array<StoragePathRow>;
  readonly storageSortDirection: StorageSortDirection;
  readonly storageSortKey: StorageSortKey;
  readonly onLoadMore: () => void;
  readonly onPathChange: (path: string) => void;
  readonly onSort: (key: StorageSortKey) => void;
};

export const StorageBrowser = ({
  data,
  filesummaryConfig,
  isLoadingMore,
  largestRowSize,
  onLoadMore,
  onPathChange,
  onSort,
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
        <div className="grid min-w-[960px] grid-cols-[140px_180px_120px_220px] items-end gap-x-8">
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
