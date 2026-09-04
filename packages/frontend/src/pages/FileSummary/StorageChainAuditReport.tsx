import React, { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconSearch, IconX } from '@tabler/icons-react';
import { formatBytes } from '../../utils/labels';
import { ChainPathTree } from './ChainPathTree';
import type { AuditActionOption } from './hooks';
import type { ChainIssueSummary } from './storageIssueSummaries';
import { buildStorageChainIssueSearchViews } from './storageChainSearch';
import {
  buildCleanupApplySummary,
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
  readonly onDismissActionFeedback: () => void;
  readonly onDismissApplyError: () => void;
  readonly onDismissApplyResult: () => void;
  readonly applyError: string | null;
  readonly applyResult: StorageCleanupApplyResult | null;
  readonly auditError: string | null;
  readonly auditResult: StorageChainAuditResult | null;
  readonly chainIssueSummaries: Array<ChainIssueSummary>;
  readonly cleanChainJoinCount: number;
  readonly expandedChainTreeNodes: Record<string, boolean>;
  readonly expandedIssueIds: Set<string>;
  readonly chainIssueFindingsByKind: Record<
    string,
    Array<StorageChainFinding>
  >;
  readonly expandedIssueLoadErrors: Record<string, string>;
  readonly expandedIssueLoadNotices: Record<string, string>;
  readonly loadingChainIssueId: string | null;
  readonly isApplying: boolean;
  readonly isAuditing: boolean;
  readonly isChainAuditing: boolean;
  readonly gitOnlyRegistrationError: string | null;
  readonly isRegisteringGitOnly: boolean;
  readonly onApplySelectedChainObjects: (
    issueId: string,
    paths: Array<string>,
  ) => void;
  readonly onRegisterSelectedGitOnly: (paths: Array<string>) => void;
  readonly onRunIssueAction: (args: RunChainIssueActionArgs) => void;
  readonly onSelectedChainPathsChange: (
    issueId: string,
    paths: Array<string>,
  ) => void;
  readonly onToggleChainIssueDetails: (issueId: string) => void;
  readonly selectedChainPathsByIssue: Record<string, Array<string>>;
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
  if (issue.id === 'git_syfon_metadata_mismatch') {
    return [];
  }
  return orderedRepairActions(issue.actionSummary.availableActions);
};

const issueDetailInitialRowLimit = 250;
const issueDetailRowLimitIncrement = 250;

export const StorageChainAuditReport = ({
  actionFeedbackMessage,
  onDismissActionFeedback,
  onDismissApplyError,
  onDismissApplyResult,
  applyError,
  applyResult,
  auditError,
  auditResult,
  chainIssueSummaries,
  chainIssueFindingsByKind,
  cleanChainJoinCount,
  expandedChainTreeNodes,
  expandedIssueIds,
  expandedIssueLoadErrors,
  expandedIssueLoadNotices,
  loadingChainIssueId,
  isApplying,
  isAuditing,
  isChainAuditing,
  gitOnlyRegistrationError,
  isRegisteringGitOnly,
  onApplySelectedChainObjects,
  onRegisterSelectedGitOnly,
  onRunIssueAction,
  onSelectedChainPathsChange,
  onToggleChainIssueDetails,
  selectedChainPathsByIssue,
  setExpandedChainTreeNodes,
  setTreeNodeLimit,
  treeNodeLimit,
}: StorageChainAuditReportProps): JSX.Element | null => {
  const [visibleIssueDetailRowLimits, setVisibleIssueDetailRowLimits] =
    useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setVisibleIssueDetailRowLimits((current) => {
      const next: Record<string, number> = {};
      expandedIssueIds.forEach((issueId) => {
        next[issueId] = current[issueId] ?? issueDetailInitialRowLimit;
      });
      return next;
    });
  }, [expandedIssueIds]);

  const issueSearchViews = useMemo(
    () =>
      buildStorageChainIssueSearchViews({
        auditFindings: auditResult?.findings ?? [],
        chainIssueFindingsByKind,
        chainIssueSummaries,
        query: searchQuery,
      }),
    [
      auditResult?.findings,
      chainIssueFindingsByKind,
      chainIssueSummaries,
      searchQuery,
    ],
  );
  const loadMoreIssueDetailRows = (issueId: string, total: number) => {
    setVisibleIssueDetailRowLimits((current) => ({
      ...current,
      [issueId]: Math.min(
        (current[issueId] ?? issueDetailInitialRowLimit) +
          issueDetailRowLimitIncrement,
        total,
      ),
    }));
  };
  const handleIssueDetailScroll = (
    issueId: string,
    total: number,
    event: React.UIEvent<HTMLDivElement>,
  ): void => {
    const target = event.currentTarget;
    const visibleLimit =
      visibleIssueDetailRowLimits[issueId] ?? issueDetailInitialRowLimit;
    if (
      visibleLimit < total &&
      target.scrollTop + target.clientHeight >= target.scrollHeight - 160
    ) {
      loadMoreIssueDetailRows(issueId, total);
    }
  };

  if (!auditResult && !auditError) {
    return (
      <Center py="xl">
        <Group gap="xs">
          {isChainAuditing ? <Loader size="xs" /> : null}
          <Text c="dimmed" size="sm">
            {isChainAuditing
              ? 'Running storage chain audit...'
              : 'No storage chain audit has been run for this project.'}
          </Text>
        </Group>
      </Center>
    );
  }

  const actualIssueSummaries = chainIssueSummaries.filter(
    (issue) => issue.id !== 'bucket_only_object',
  );
  const issuePathCount = actualIssueSummaries.reduce(
    (sum, issue) => sum + issue.pathCount,
    0,
  );
  const totalChainRows = cleanChainJoinCount + issuePathCount;
  const totalScopedRows =
    auditResult?.summary.gitTrackedFileCount ?? totalChainRows;
  const isBusy =
    isApplying || isAuditing || isChainAuditing || isRegisteringGitOnly;
  const isSearching = searchQuery.trim().length > 0;

  const renderRepairActions = (
    issue: ChainIssueSummary,
    issueFindings: Array<StorageChainFinding>,
    isIssueLoading: boolean,
  ): JSX.Element | null => {
    if (issue.id === 'git_only_no_syfon') {
      return null;
    }
    if (isIssueLoading || issueFindings.length === 0) {
      return null;
    }
    const repairActions = repairActionsForIssue(issue);

    const runRepairAction = (action: AuditActionOption) => {
      onRunIssueAction({
        defaultAction: action,
        findings: issueFindings,
        issueId: issue.id,
        issueTitle: issue.title,
        paths: issueFindings.map((finding) => finding.normalizedPath),
      });
    };

    const suggestedFindings = issueFindings.filter(
      (finding) => finding.suggestedAction,
    );
    const suggestedFixButton =
      suggestedFindings.length > 0 ? (
        <Button
          color={issue.color}
          loading={isBusy}
          onClick={() =>
            runRepairAction({
              action: 'apply_suggested_fixes',
              destructive: true,
              label: 'Apply suggested fixes',
              requiresConfirmation: true,
              supportsDryRun: true,
            })
          }
          size="xs"
          variant="light"
        >
          Apply suggested fixes ({suggestedFindings.length.toLocaleString()})
        </Button>
      ) : null;

    return suggestedFixButton || repairActions.length > 0 ? (
      <Group gap="xs">
        {suggestedFixButton}
        {repairActions.map((action) => (
          <Button
            color={issue.color}
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

          {auditResult?.summary.auditCacheError ? (
            <Alert
              color="yellow"
              icon={<IconAlertCircle size={16} />}
              title="Audit cache write failed"
            >
              {auditResult.summary.auditCacheError}
            </Alert>
          ) : null}

          {actionFeedbackMessage && !applyResult ? (
            <Alert
              color="blue"
              icon={<IconAlertCircle size={16} />}
              onClose={onDismissActionFeedback}
              title="Action complete"
              withCloseButton
            >
              {actionFeedbackMessage}
            </Alert>
          ) : null}

          {applyError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              onClose={onDismissApplyError}
              title="Cleanup apply failed"
              withCloseButton
            >
              {applyError}
            </Alert>
          ) : null}

          {gitOnlyRegistrationError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              title="Syfon record creation failed"
            >
              {gitOnlyRegistrationError}
            </Alert>
          ) : null}

          {applyResult ? (
            <Alert
              color={applyResult.dryRun ? 'blue' : 'green'}
              icon={<IconAlertCircle size={16} />}
              onClose={onDismissApplyResult}
              title={applyResult.dryRun ? 'Cleanup dry run' : 'Cleanup applied'}
              withCloseButton
            >
              {buildCleanupApplySummary(applyResult)}
            </Alert>
          ) : null}

          {auditResult ? (
            <>
              <TextInput
                aria-label="Search audit findings"
                description="Search findings returned by this audit. Backend response limits may omit rows."
                leftSection={<IconSearch size={16} />}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder="Search paths, checksums, URLs, errors, or actions"
                rightSection={
                  searchQuery ? (
                    <ActionIcon
                      aria-label="Clear audit finding search"
                      onClick={() => setSearchQuery('')}
                      size="sm"
                      variant="subtle"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
                value={searchQuery}
              />
              <Alert
                color={actualIssueSummaries.length > 0 ? 'yellow' : 'green'}
              >
                <Stack gap={2}>
                  <Text size="sm">
                    <strong>
                      {cleanChainJoinCount.toLocaleString()} /{' '}
                      {totalScopedRows.toLocaleString()} audited rows fully
                      connected.
                    </strong>
                  </Text>
                  <Text size="sm">
                    Checked{' '}
                    {auditResult.summary.bucketObjectCount.toLocaleString()}{' '}
                    bucket objects,{' '}
                    {auditResult.summary.syfonRecordCount.toLocaleString()}{' '}
                    Syfon records, and{' '}
                    {auditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
                    Git-tracked files.
                  </Text>
                </Stack>
              </Alert>

              {isSearching && issueSearchViews.length === 0 ? (
                <Alert color="blue" title="No matching audit findings">
                  No findings returned by this audit match &quot;
                  {searchQuery.trim()}&quot;.
                </Alert>
              ) : issueSearchViews.length > 0 ? (
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Issue</Table.Th>
                      <Table.Th>Impact</Table.Th>
                      <Table.Th>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {issueSearchViews.map((view) => {
                      const { findings: issueFindings, issue, matchedFindings } =
                        view;
                      const isExpanded =
                        expandedIssueIds.has(issue.id) ||
                        (isSearching && matchedFindings.length > 0);
                      const isIssueLoading =
                        loadingChainIssueId === issue.id;
                      const issueLoadError =
                        expandedIssueLoadErrors[issue.id];
                      const issueNotice =
                        expandedIssueLoadNotices[issue.id];
                      const isIssueSelectable =
                        issue.id === 'bucket_only_object' ||
                        issue.id === 'bucket_syfon_no_git' ||
                        issue.id === 'git_only_no_syfon';
                      const issueSelectedPaths =
                        selectedChainPathsByIssue[issue.id] ?? [];
                      const matchedIssuePaths = new Set(
                        matchedFindings.map(
                          (finding) => finding.normalizedPath,
                        ),
                      );
                      const visibleSelectedPaths = isSearching
                        ? issueSelectedPaths.filter((path) =>
                            matchedIssuePaths.has(path),
                          )
                        : issueSelectedPaths;
                      const visibleLimit =
                        visibleIssueDetailRowLimits[issue.id] ??
                        issueDetailInitialRowLimit;
                      const visibleIssueFindings = matchedFindings.slice(
                        0,
                        visibleLimit,
                      );
                      const hasMoreIssueFindings =
                        visibleIssueFindings.length < matchedFindings.length;
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
                              {isSearching ? (
                                <Text c="dimmed" size="xs">
                                  Showing matches
                                </Text>
                              ) : (
                                <Button
                                  onClick={() =>
                                    onToggleChainIssueDetails(issue.id)
                                  }
                                  size="xs"
                                  variant={isExpanded ? 'outline' : 'light'}
                                >
                                  {isExpanded ? 'Hide details' : 'View details'}
                                </Button>
                              )}
                            </Table.Td>
                          </Table.Tr>

                          {isExpanded ? (
                            <Table.Tr>
                              <Table.Td colSpan={3}>
                                <Stack
                                  className="bg-slate-50 px-4 py-4"
                                  gap="sm"
                                >
                                  <Group justify="space-between" wrap="wrap">
                                    <div>
                                      <Text fw={700} size="sm">
                                        {issue.title}
                                      </Text>
                                      <Text c="dimmed" size="sm">
                                        {isIssueLoading
                                          ? 'Loading all issue findings...'
                                          : isSearching
                                            ? `${matchedFindings.length.toLocaleString()} matching of ${issueFindings.length.toLocaleString()} loaded path${issueFindings.length === 1 ? '' : 's'} in this issue set.`
                                            : `${issueFindings.length.toLocaleString()} loaded path${issueFindings.length === 1 ? '' : 's'} in this issue set.`}
                                      </Text>
                                    </div>
                                    {isIssueSelectable ? (
                                      <Button
                                        color={issue.color}
                                        disabled={
                                          visibleSelectedPaths.length === 0
                                        }
                                        loading={isApplying || isAuditing}
                                        onClick={() =>
                                          issue.id === 'git_only_no_syfon'
                                            ? onRegisterSelectedGitOnly(
                                                visibleSelectedPaths,
                                              )
                                            : onApplySelectedChainObjects(
                                                issue.id,
                                                visibleSelectedPaths,
                                              )
                                        }
                                        size="xs"
                                        variant="light"
                                      >
                                        {issue.id === 'bucket_only_object'
                                          ? 'Delete selected bucket objects'
                                          : issue.id === 'git_only_no_syfon'
                                            ? 'Create Syfon records'
                                            : 'Delete selected objects'}
                                        {visibleSelectedPaths.length > 0
                                          ? ` (${visibleSelectedPaths.length.toLocaleString()})`
                                          : ''}
                                      </Button>
                                    ) : (
                                      <Stack align="flex-end" gap={4}>
                                        {renderRepairActions(
                                          issue,
                                          issueFindings,
                                          isIssueLoading,
                                        )}
                                        {isSearching ? (
                                          <Text c="dimmed" size="xs">
                                            Actions apply to every loaded path in
                                            this issue set.
                                          </Text>
                                        ) : null}
                                      </Stack>
                                    )}
                                  </Group>

                                  {issueLoadError ? (
                                    <Alert
                                      color="red"
                                      icon={<IconAlertCircle size={16} />}
                                      title="Issue details failed"
                                    >
                                      {issueLoadError}
                                    </Alert>
                                  ) : null}

                                  {issueNotice ? (
                                    <Alert
                                      color="blue"
                                      icon={<IconAlertCircle size={16} />}
                                      title="Audit response rows"
                                    >
                                      {issueNotice}
                                    </Alert>
                                  ) : null}

                                  {isIssueLoading &&
                                  matchedFindings.length === 0 ? (
                                    <Center py="md">
                                      <Group gap="xs">
                                        <Loader size="xs" />
                                        <Text c="dimmed" size="sm">
                                          Loading complete issue details...
                                        </Text>
                                      </Group>
                                    </Center>
                                  ) : isIssueSelectable && isSearching ? (
                                    <div
                                      className="max-h-[420px] overflow-auto rounded-md border border-slate-200 bg-white px-3 py-2"
                                      onScroll={(event) =>
                                        handleIssueDetailScroll(
                                          issue.id,
                                          matchedFindings.length,
                                          event,
                                        )
                                      }
                                    >
                                      <Stack gap={4}>
                                        {visibleIssueFindings.map((finding) => (
                                          <Checkbox
                                            checked={visibleSelectedPaths.includes(
                                              finding.normalizedPath,
                                            )}
                                            key={`${finding.kind}:${finding.normalizedPath}`}
                                            label={finding.normalizedPath}
                                            onChange={(event) => {
                                              const path =
                                                finding.normalizedPath;
                                              onSelectedChainPathsChange(
                                                issue.id,
                                                event.currentTarget.checked
                                                  ? Array.from(
                                                      new Set([
                                                        ...issueSelectedPaths,
                                                        path,
                                                      ]),
                                                    ).sort()
                                                  : issueSelectedPaths.filter(
                                                      (selectedPath) =>
                                                        selectedPath !== path,
                                                    ),
                                              );
                                            }}
                                          />
                                        ))}
                                        {hasMoreIssueFindings ? (
                                          <Text c="dimmed" py="xs" size="xs">
                                            Showing{' '}
                                            {visibleIssueFindings.length.toLocaleString()}{' '}
                                            of{' '}
                                            {matchedFindings.length.toLocaleString()}{' '}
                                            matching paths. Scroll for more.
                                          </Text>
                                        ) : null}
                                      </Stack>
                                    </div>
                                  ) : isIssueSelectable ? (
                                    <ChainPathTree
                                      expandedTreeNodes={expandedChainTreeNodes}
                                      findings={issueFindings}
                                      helperText={
                                        issue.id === 'git_only_no_syfon'
                                          ? 'Gecko rechecks every selected path against the live bucket before creating a record. RGW does not provide a SHA-256 for this verification.'
                                          : undefined
                                      }
                                      onSelectedPathsChange={(paths) =>
                                        onSelectedChainPathsChange(issue.id, paths)
                                      }
                                      onTreeNodeLimitChange={setTreeNodeLimit}
                                      onTreeNodeToggle={setExpandedChainTreeNodes}
                                      rootLimitKey={issue.id}
                                      selectedPaths={issueSelectedPaths}
                                      treeNodeLimit={treeNodeLimit}
                                    />
                                  ) : (
                                    <div
                                      className="max-h-[420px] overflow-auto rounded-md border border-slate-200 bg-white"
                                      onScroll={(event) =>
                                        handleIssueDetailScroll(
                                          issue.id,
                                          matchedFindings.length,
                                          event,
                                        )
                                      }
                                    >
                                      <Table highlightOnHover stickyHeader>
                                        <Table.Thead>
                                          <Table.Tr>
                                            <Table.Th>Path</Table.Th>
                                            <Table.Th>Checksum</Table.Th>
                                            <Table.Th>Evidence</Table.Th>
                                            <Table.Th>Suggested fix</Table.Th>
                                            <Table.Th>Records</Table.Th>
                                            <Table.Th>Objects</Table.Th>
                                          </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                          {matchedFindings.length > 0 ? (
                                            visibleIssueFindings.map(
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
                                                  <Table.Td maw={520}>
                                                    <Text size="sm">
                                                      {finding.suggestedFix ||
                                                        finding.recommendedAction ||
                                                        '—'}
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
                                              <Table.Td colSpan={6}>
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
                                          {hasMoreIssueFindings ? (
                                            <Table.Tr>
                                              <Table.Td colSpan={6}>
                                                <Center py="sm">
                                                  <Text c="dimmed" size="xs">
                                                    Showing{' '}
                                                    {visibleIssueFindings.length.toLocaleString()}{' '}
                                                    of{' '}
                                                    {matchedFindings.length.toLocaleString()}{' '}
                                                    paths. Scroll for more.
                                                  </Text>
                                                </Center>
                                              </Table.Td>
                                            </Table.Tr>
                                          ) : null}
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
    </Stack>
  );
};
