import React from 'react';
import {
  Alert,
  Badge,
  Button,
  Collapse,
  Group,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconChevronRight } from '@tabler/icons-react';
import { formatBytes } from '../../utils/labels';
import type { ChainIssueSummary } from './storageIssueSummaries';
import type { StorageChainAuditResult } from './storageTypes';

type StorageChainAuditReportProps = {
  readonly auditError: string | null;
  readonly auditResult: StorageChainAuditResult | null;
  readonly chainIssueSummaries: Array<ChainIssueSummary>;
  readonly cleanChainJoinCount: number;
  readonly isOpen: boolean;
  readonly onOpenIssueDetails: (issueId: string) => void;
  readonly onOpenChange: (open: boolean) => void;
};

export const StorageChainAuditReport = ({
  auditError,
  auditResult,
  chainIssueSummaries,
  cleanChainJoinCount,
  isOpen,
  onOpenIssueDetails,
  onOpenChange,
}: StorageChainAuditReportProps): JSX.Element | null => {
  if (!auditResult && !auditError) {
    return null;
  }

  const issuePathCount = chainIssueSummaries.reduce(
    (sum, issue) => sum + issue.pathCount,
    0,
  );
  const totalChainRows = cleanChainJoinCount + issuePathCount;

  return (
    <Stack gap="sm" px="sm">
      <Group justify="space-between">
        <Group gap="xs">
          <button
            className="flex items-center gap-2 text-left text-sm font-semibold text-slate-900"
            onClick={() => onOpenChange(!isOpen)}
            type="button"
          >
            <IconChevronRight
              className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
              size={16}
            />
            Storage chain audit report
          </button>
          {auditResult ? (
            <Badge
              color={chainIssueSummaries.length > 0 ? 'yellow' : 'green'}
              variant="light"
            >
              {issuePathCount.toLocaleString()} issue paths
            </Badge>
          ) : null}
        </Group>
        <Button
          onClick={() => onOpenChange(!isOpen)}
          size="xs"
          variant="subtle"
        >
          {isOpen ? 'Hide report' : 'View report'}
        </Button>
      </Group>

      <Collapse in={isOpen}>
        <Stack gap="md">
          {auditError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              title="Chain audit failed"
            >
              {auditError}
            </Alert>
          ) : null}

          {auditResult ? (
            <>
              <Alert
                color={chainIssueSummaries.length > 0 ? 'yellow' : 'green'}
                icon={<IconAlertCircle size={16} />}
                title={
                  chainIssueSummaries.length > 0
                    ? 'Chain issues found'
                    : 'Connected end-to-end'
                }
              >
                <Text size="sm">
                  <strong>
                    {cleanChainJoinCount.toLocaleString()} /{' '}
                    {totalChainRows.toLocaleString()} audited rows connected
                    end-to-end.
                  </strong>{' '}
                  Scope: scanned{' '}
                  {auditResult.summary.bucketObjectCount.toLocaleString()}{' '}
                  bucket objects,{' '}
                  {auditResult.summary.syfonRecordCount.toLocaleString()} Syfon
                  records, and{' '}
                  {auditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
                  Git-tracked files.
                </Text>
              </Alert>

              {chainIssueSummaries.length > 0 ? (
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Chain Issue</Table.Th>
                      <Table.Th>Impact</Table.Th>
                      <Table.Th>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {chainIssueSummaries.map((issue) => (
                      <Table.Tr key={issue.id}>
                        <Table.Td miw={420}>
                          <Stack gap={4}>
                            <Group gap={8}>
                              <Badge color={issue.color} variant="light">
                                {issue.pathCount.toLocaleString()} paths
                              </Badge>
                              <Text fw={700} size="sm">
                                {issue.title}
                              </Text>
                            </Group>
                            <Text c="dimmed" size="sm">
                              {issue.description}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {issue.recordCount.toLocaleString()} records{' · '}
                            {issue.objectCount.toLocaleString()} objects{' · '}
                            {formatBytes(issue.totalBytes)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            onClick={() => onOpenIssueDetails(issue.id)}
                            size="xs"
                            variant="light"
                          >
                            {issue.actionSummary.defaultAction?.label ??
                              'Open details'}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Collapse>
    </Stack>
  );
};
