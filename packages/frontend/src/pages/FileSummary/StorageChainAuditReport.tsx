import React from 'react';
import {
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  Collapse,
  Group,
  Loader,
  Menu,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconChevronRight } from '@tabler/icons-react';
import { formatBytes } from '../../utils/labels';
import { ChainPathTree } from './ChainPathTree';
import type { AuditActionOption } from './hooks';
import type { ChainIssueSummary } from './storageIssueSummaries';
import {
  buildCleanupApplySummary,
  buildPathsByParentMap,
  orderedRepairActions,
} from './storagePresentation';
import type {
  StorageChainAuditResult,
  StorageChainFinding,
  StorageCleanupApplyResult,
} from './storageTypes';

type RunChainIssueActionArgs = {
  defaultAction?: AuditActionOption;
  findings: Array<StorageChainFinding>;
  issueId: string;
  issueTitle: string;
  paths: Array<string>;
};

type StorageChainAuditReportProps = {
  readonly actionFeedbackMessage: string | null;
  readonly applyError: string | null;
  readonly applyResult: StorageCleanupApplyResult | null;
  readonly auditError: string | null;
  readonly auditResult: StorageChainAuditResult | null;
  readonly chainIssueSummaries: Array<ChainIssueSummary>;
  readonly cleanChainJoinCount: number;
  readonly expandedChainTreeNodes: Record<string, boolean>;
  readonly expandedIssueId: string | null;
  readonly expandedIssueLoadError?: string;
  readonly expandedIssueLoading: boolean;
  readonly expandedIssueFindings: Array<StorageChainFinding>;
  readonly isApplying: boolean;
  readonly isAuditing: boolean;
  readonly isChainAuditing: boolean;
  readonly isOpen: boolean;
  readonly onApplySelectedChainObjects: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRunIssueAction: (args: RunChainIssueActionArgs) => void;
  readonly onSelectedChainPathsChange: (paths: Array<string>) => void;
  readonly onToggleAllChainPaths: (checked: boolean) => void;
  readonly onToggleChainIssueDetails: (issueId: string) => void;
  readonly onToggleChainPath: (path: string, checked: boolean) => void;
  readonly selectedChainPaths: Array<string>;
  readonly selectedChainPathsSet: Set<string>;
  readonly setExpandedChainTreeNodes: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  readonly setTreeNodeLimit: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  readonly treeNodeLimit: Record<string, number>;
};

const chainEvidenceForFinding = (finding: StorageChainFinding): string => {
  const values = [
    finding.error,
    finding.accessUrls[0],
    finding.bucketObjectUrl,
    finding.resolvedBucket && finding.resolvedKey
      ? `${finding.resolvedBucket}/${finding.resolvedKey}`
      : '',
  ].filter(Boolean);

  return values[0] ?? '—';
};

const repairActionsForIssue = (
  issue: ChainIssueSummary,
): Array<AuditActionOption> => {
  const isMetadataMismatch = issue.id === 'git_syfon_metadata_mismatch';
  return orderedRepairActions(issue.actionSummary.availableActions).filter(
    (action) =>
      !isMetadataMismatch ||
      ['delete_syfon_record', 'delete_records', 'delete_both'].includes(
        action.action,
      ),
  );
};

export const StorageChainAuditReport = ({
  actionFeedbackMessage,
  applyError,
  applyResult,
  auditError,
  auditResult,
  chainIssueSummaries,
  cleanChainJoinCount,
  expandedChainTreeNodes,
  expandedIssueFindings,
  expandedIssueId,
  expandedIssueLoadError,
  expandedIssueLoading,
  isApplying,
  isAuditing,
  isChainAuditing,
  isOpen,
  onApplySelectedChainObjects,
  onOpenChange,
  onRunIssueAction,
  onSelectedChainPathsChange,
  onToggleAllChainPaths,
  onToggleChainIssueDetails,
  onToggleChainPath,
  selectedChainPaths,
  selectedChainPathsSet,
  setExpandedChainTreeNodes,
  setTreeNodeLimit,
  treeNodeLimit,
}: StorageChainAuditReportProps): JSX.Element | null => {
  if (!auditResult && !auditError) {
    return null;
  }

  const issuePathCount = chainIssueSummaries.reduce(
    (sum, issue) => sum + issue.pathCount,
    0,
  );
  const totalChainRows = cleanChainJoinCount + issuePathCount;
  const expandedIssue =
    chainIssueSummaries.find((issue) => issue.id === expandedIssueId) ?? null;
  const isExpandedIssueSelectable =
    expandedIssue?.id === 'bucket_only_object' ||
    expandedIssue?.id === 'bucket_syfon_no_git';
  const selectableChainPaths = Array.from(
    new Set(
      expandedIssueFindings
        .map((finding) => finding.normalizedPath)
        .filter(Boolean),
    ),
  ).sort();
  const pathsByParent = buildPathsByParentMap(selectableChainPaths);
  const chainPathTree = pathsByParent.get('') ?? [];
  const repairActions = expandedIssue
    ? repairActionsForIssue(expandedIssue)
    : [];
  const isBusy = isApplying || isAuditing || isChainAuditing;

  const renderRepairActions = (): JSX.Element | null => {
    if (!expandedIssue || expandedIssue.id === 'git_only_no_syfon') {
      return null;
    }
    if (expandedIssueLoading || expandedIssueFindings.length === 0) {
      return null;
    }

    const runRepairAction = (action: AuditActionOption) => {
      onRunIssueAction({
        defaultAction: action,
        findings: expandedIssueFindings,
        issueId: expandedIssue.id,
        issueTitle: expandedIssue.title,
        paths: expandedIssueFindings.map((finding) => finding.normalizedPath),
      });
    };

    if (
      expandedIssue.id === 'git_syfon_metadata_mismatch' &&
      repairActions.length > 1
    ) {
      return (
        <Menu shadow="md" withinPortal>
          <Menu.Target>
            <Button
              color={expandedIssue.color}
              loading={isBusy}
              size="xs"
              variant="light"
            >
              Choose fix
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {repairActions.map((action) => (
              <Menu.Item
                color={action.destructive ? 'red' : undefined}
                key={action.action}
                onClick={() => runRepairAction(action)}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      );
    }

    return repairActions.length > 0 ? (
      <Group gap="xs">
        {repairActions.map((action) => (
          <Button
            color={expandedIssue.color}
            key={action.action}
            loading={isBusy}
            onClick={() => runRepairAction(action)}
            size="xs"
            variant={
              action.action === repairActions[0].action ? 'light' : 'outline'
            }
          >
            {action.label}
          </Button>
        ))}
      </Group>
    ) : null;
  };

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
              {issuePathCount.toLocaleString()} issues
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

          {actionFeedbackMessage ? (
            <Alert
              color="blue"
              icon={<IconAlertCircle size={16} />}
              title="Action complete"
            >
              {actionFeedbackMessage}
            </Alert>
          ) : null}

          {applyError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              title="Cleanup apply failed"
            >
              {applyError}
            </Alert>
          ) : null}

          {applyResult ? (
            <Alert
              color={applyResult.dryRun ? 'blue' : 'green'}
              icon={<IconAlertCircle size={16} />}
              title={applyResult.dryRun ? 'Cleanup dry run' : 'Cleanup applied'}
            >
              {buildCleanupApplySummary(applyResult)}
            </Alert>
          ) : null}

          {auditResult ? (
            <>
              <Alert
                color={chainIssueSummaries.length > 0 ? 'yellow' : 'green'}
                icon={<IconAlertCircle size={16} />}
                title={
                  chainIssueSummaries.length > 0
                    ? 'Issues found'
                    : 'Fully connected'
                }
              >
                <Text size="sm">
                  <strong>
                    {cleanChainJoinCount.toLocaleString()} /{' '}
                    {totalChainRows.toLocaleString()} audited rows fully
                    connected.
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
                    {chainIssueSummaries.map((issue) => {
                      const isExpanded = expandedIssueId === issue.id;
                      return (
                        <React.Fragment key={issue.id}>
                          <Table.Tr>
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
                                {issue.recordCount.toLocaleString()} records
                                {' · '}
                                {issue.objectCount.toLocaleString()} objects
                                {' · '}
                                {formatBytes(issue.totalBytes)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Button
                                onClick={() =>
                                  onToggleChainIssueDetails(issue.id)
                                }
                                size="xs"
                                variant={isExpanded ? 'outline' : 'light'}
                              >
                                {isExpanded ? 'Hide details' : 'View details'}
                              </Button>
                            </Table.Td>
                          </Table.Tr>

                          {isExpanded ? (
                            <Table.Tr>
                              <Table.Td colSpan={3}>
                                <Stack
                                  className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
                                  gap="sm"
                                >
                                  <Group justify="space-between" wrap="wrap">
                                    <div>
                                      <Text fw={700} size="sm">
                                        {issue.title}
                                      </Text>
                                      <Text c="dimmed" size="sm">
                                        {expandedIssueLoading
                                          ? 'Loading all issue findings...'
                                          : `${expandedIssueFindings.length.toLocaleString()} loaded path${expandedIssueFindings.length === 1 ? '' : 's'} in this issue set.`}
                                      </Text>
                                    </div>
                                    {isExpandedIssueSelectable ? (
                                      <Button
                                        color={issue.color}
                                        disabled={
                                          selectedChainPaths.length === 0
                                        }
                                        loading={isApplying || isAuditing}
                                        onClick={onApplySelectedChainObjects}
                                        size="xs"
                                        variant="light"
                                      >
                                        {issue.id === 'bucket_only_object'
                                          ? 'Delete selected bucket objects'
                                          : 'Delete selected objects'}
                                        {selectedChainPaths.length > 0
                                          ? ` (${selectedChainPaths.length.toLocaleString()})`
                                          : ''}
                                      </Button>
                                    ) : (
                                      renderRepairActions()
                                    )}
                                  </Group>

                                  {expandedIssueLoadError ? (
                                    <Alert
                                      color="red"
                                      icon={<IconAlertCircle size={16} />}
                                      title="Issue details failed"
                                    >
                                      {expandedIssueLoadError}
                                    </Alert>
                                  ) : null}

                                  {expandedIssueLoading &&
                                  expandedIssueFindings.length === 0 ? (
                                    <Center py="md">
                                      <Group gap="xs">
                                        <Loader size="xs" />
                                        <Text c="dimmed" size="sm">
                                          Loading complete issue details...
                                        </Text>
                                      </Group>
                                    </Center>
                                  ) : isExpandedIssueSelectable ? (
                                    <Stack
                                      className="rounded-md border border-slate-200 bg-white px-3 py-3"
                                      gap="xs"
                                    >
                                      <Group
                                        justify="space-between"
                                        wrap="wrap"
                                      >
                                        <Checkbox
                                          checked={
                                            selectableChainPaths.length > 0 &&
                                            selectedChainPaths.length ===
                                              selectableChainPaths.length
                                          }
                                          indeterminate={
                                            selectedChainPaths.length > 0 &&
                                            selectedChainPaths.length <
                                              selectableChainPaths.length
                                          }
                                          label={`Select all loaded paths (${selectedChainPaths.length.toLocaleString()} / ${selectableChainPaths.length.toLocaleString()})`}
                                          onChange={(event) => {
                                            onToggleAllChainPaths(
                                              event.currentTarget.checked,
                                            );
                                          }}
                                        />
                                        <Text c="dimmed" size="xs">
                                          Expand folders and choose the exact
                                          paths to heal.
                                        </Text>
                                      </Group>
                                      <ChainPathTree
                                        expandedTreeNodes={
                                          expandedChainTreeNodes
                                        }
                                        nodes={chainPathTree.slice(
                                          0,
                                          treeNodeLimit[''] ?? 100,
                                        )}
                                        onSelectedPathsChange={
                                          onSelectedChainPathsChange
                                        }
                                        onTogglePath={onToggleChainPath}
                                        onTreeNodeLimitChange={setTreeNodeLimit}
                                        onTreeNodeToggle={
                                          setExpandedChainTreeNodes
                                        }
                                        pathsByParent={pathsByParent}
                                        selectedPaths={selectedChainPaths}
                                        selectedPathsSet={selectedChainPathsSet}
                                        treeNodeLimit={treeNodeLimit}
                                      />
                                      {chainPathTree.length >
                                        (treeNodeLimit[''] ?? 100) && (
                                        <Button
                                          onClick={() =>
                                            setTreeNodeLimit((current) => ({
                                              ...current,
                                              '': (current[''] ?? 100) + 100,
                                            }))
                                          }
                                          size="xs"
                                          style={{
                                            alignSelf: 'flex-start',
                                            marginLeft: 28,
                                          }}
                                          variant="subtle"
                                        >
                                          Show more (
                                          {(
                                            chainPathTree.length -
                                            (treeNodeLimit[''] ?? 100)
                                          ).toLocaleString()}{' '}
                                          remaining)...
                                        </Button>
                                      )}
                                    </Stack>
                                  ) : (
                                    <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200 bg-white">
                                      <Table highlightOnHover stickyHeader>
                                        <Table.Thead>
                                          <Table.Tr>
                                            <Table.Th>Path</Table.Th>
                                            <Table.Th>Checksum</Table.Th>
                                            <Table.Th>Evidence</Table.Th>
                                            <Table.Th>Records</Table.Th>
                                            <Table.Th>Objects</Table.Th>
                                          </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                          {expandedIssueFindings.length > 0 ? (
                                            expandedIssueFindings.map(
                                              (finding) => (
                                                <Table.Tr
                                                  key={`${finding.kind}:${finding.normalizedPath}`}
                                                >
                                                  <Table.Td maw={560}>
                                                    <Text
                                                      className="break-all"
                                                      fw={600}
                                                      size="sm"
                                                    >
                                                      {finding.normalizedPath}
                                                    </Text>
                                                  </Table.Td>
                                                  <Table.Td maw={260}>
                                                    <Text
                                                      className="break-all font-mono"
                                                      size="xs"
                                                    >
                                                      {finding.checksum || '—'}
                                                    </Text>
                                                  </Table.Td>
                                                  <Table.Td maw={520}>
                                                    <Text
                                                      className="break-all"
                                                      size="xs"
                                                    >
                                                      {chainEvidenceForFinding(
                                                        finding,
                                                      )}
                                                    </Text>
                                                  </Table.Td>
                                                  <Table.Td>
                                                    {finding.recordCount.toLocaleString()}
                                                  </Table.Td>
                                                  <Table.Td>
                                                    {finding.objectIds.length.toLocaleString()}
                                                  </Table.Td>
                                                </Table.Tr>
                                              ),
                                            )
                                          ) : (
                                            <Table.Tr>
                                              <Table.Td colSpan={5}>
                                                <Text
                                                  c="dimmed"
                                                  py="md"
                                                  ta="center"
                                                >
                                                  No issue details were returned
                                                  for this finding kind.
                                                </Text>
                                              </Table.Td>
                                            </Table.Tr>
                                          )}
                                        </Table.Tbody>
                                      </Table>
                                    </div>
                                  )}
                                </Stack>
                              </Table.Td>
                            </Table.Tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
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
