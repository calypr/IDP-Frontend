import React from 'react';
import {
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { formatBytes } from '../../utils/labels';
import { ChainPathTree } from './ChainPathTree';
import type { AuditActionOption } from './hooks';
import type { StorageChainAuditModalProps } from './StorageChainAuditModal.types';
import { issueColorForDiffKind } from './storageIssueSummaries';
import {
  buildCleanupApplySummary,
  formatCleanupFindingLabel,
  orderedRepairActions,
  resolveIssueAction,
} from './storagePresentation';

export const StorageChainAuditModal = ({
  actionFeedbackMessage,
  actionableChainSelectionIssue,
  applyError,
  applyResult,
  auditError,
  auditResult,
  chainAuditError,
  chainAuditResult,
  chainIssueSummaries,
  chainPathTree,
  cleanChainJoinCount,
  cleanupIssueSummaries,
  diffAuditResult,
  diffIssueSummaries,
  expandedChainTreeNodes,
  hasChainIssues,
  hasCleanupFindings,
  hasSafeDuplicateCleanup,
  isApplying,
  isAuditing,
  isBulkDeletingRecords,
  isChainAuditing,
  isDuplicateVerificationContext,
  onApplySelectedChainObjects,
  onClose,
  onRunIssueAction,
  onSelectedChainPathsChange,
  onSelectedDiffIssueChange,
  onToggleAllChainPaths,
  onToggleChainIssueDetails,
  onToggleChainPath,
  opened,
  pathsByParent,
  selectableChainPaths,
  selectedChainFindings,
  selectedChainIssue,
  selectedChainPaths,
  selectedChainPathsSet,
  selectedDiffFindings,
  selectedDiffIssue,
  setExpandedChainTreeNodes,
  setTreeNodeLimit,
  showCleanupDetails,
  showDiffDetails,
  treeNodeLimit,
}: StorageChainAuditModalProps): JSX.Element => (
  <Modal
    onClose={onClose}
    opened={opened}
    size="min(1680px, 96vw)"
    title="Storage Chain Audit"
  >
    <Stack gap="md">
      <Text c="dimmed" size="sm">
        Gecko audits the chain from bucket objects to Syfon records to
        Git-tracked files. Anything that falls out of that chain is surfaced
        here as a cleanup or ingest issue.
      </Text>

      {chainAuditError ? (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          title="Chain audit failed"
        >
          {chainAuditError}
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

      {chainAuditResult &&
      !chainAuditResult.summary.bucketInventoryAvailable ? (
        <Alert
          color="orange"
          icon={<IconAlertCircle size={16} />}
          title="Bucket inventory unavailable"
        >
          Syfon could not enumerate the mapped bucket target for this project.
          Gecko kept the audit running using record-backed storage validation,
          but bucket-only object detection and bucket object totals are limited
          to what fallback validation could prove.
          {chainAuditResult.summary.bucketInventoryError ? (
            <Text mt={8} size="sm">
              {chainAuditResult.summary.bucketInventoryError}
            </Text>
          ) : null}
        </Alert>
      ) : null}

      {chainAuditResult &&
      chainAuditResult.summary.bucketInventoryAvailable &&
      !hasChainIssues &&
      cleanChainJoinCount > 0 ? (
        <Alert
          color="green"
          icon={<IconAlertCircle size={16} />}
          title="Connected end-to-end"
        >
          <Stack gap={4}>
            <Text size="sm">
              <strong>Working rows:</strong>{' '}
              {cleanChainJoinCount.toLocaleString()} bucket objects join cleanly
              through Syfon into Git.
            </Text>
            <Text size="sm">
              <strong>Problem rows:</strong> 0 issue paths need attention in
              this subtree.
            </Text>
            <Text size="sm">
              <strong>Audit scope:</strong> scanned{' '}
              {chainAuditResult.summary.bucketObjectCount.toLocaleString()}{' '}
              bucket objects,{' '}
              {chainAuditResult.summary.syfonRecordCount.toLocaleString()} Syfon
              records, and{' '}
              {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
              Git-tracked files.
            </Text>
          </Stack>
        </Alert>
      ) : null}

      {chainAuditResult &&
      chainAuditResult.summary.bucketInventoryAvailable &&
      hasChainIssues ? (
        <Alert
          color="yellow"
          icon={<IconAlertCircle size={16} />}
          title="Chain issues found"
        >
          <Stack gap={4}>
            <Text size="sm">
              <strong>Working rows:</strong>{' '}
              {cleanChainJoinCount.toLocaleString()} bucket objects join cleanly
              through Syfon into Git.
            </Text>
            <Text size="sm">
              <strong>Problem rows:</strong>{' '}
              {chainIssueSummaries
                .reduce((sum, issue) => sum + issue.pathCount, 0)
                .toLocaleString()}{' '}
              issue paths need attention in this subtree.
            </Text>
            <Text size="sm">
              <strong>Audit scope:</strong> scanned{' '}
              {chainAuditResult.summary.bucketObjectCount.toLocaleString()}{' '}
              bucket objects,{' '}
              {chainAuditResult.summary.syfonRecordCount.toLocaleString()} Syfon
              records, and{' '}
              {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
              Git-tracked files.
            </Text>
          </Stack>
        </Alert>
      ) : null}

      {chainAuditResult &&
      !chainAuditResult.summary.bucketInventoryAvailable ? (
        <Alert
          color="yellow"
          icon={<IconAlertCircle size={16} />}
          title="Record-backed connectivity only"
        >
          {cleanChainJoinCount.toLocaleString()} record-backed storage objects
          currently validate cleanly through Syfon into Git, but the default
          bucket-first audit is blocked because the mapped bucket target could
          not be enumerated. Totals scanned:{' '}
          {chainAuditResult.summary.bucketObjectCount.toLocaleString()}{' '}
          probe-backed bucket objects,{' '}
          {chainAuditResult.summary.syfonRecordCount.toLocaleString()} Syfon
          records,{' '}
          {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
          Git-tracked files.
        </Alert>
      ) : null}

      {isChainAuditing && !chainAuditResult && !chainAuditError ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              Running bucket, Syfon, and Git chain audit...
            </Text>
          </Stack>
        </Center>
      ) : chainIssueSummaries.length > 0 ? (
        <Stack gap="sm">
          <div>
            <Title order={5}>Chain Findings</Title>
            <Text c="dimmed" mt={4} size="sm">
              Issues found in the files, records, and project contents for this
              path.
            </Text>
          </div>

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
                  <Table.Td miw={260}>
                    {actionableChainSelectionIssue &&
                    selectedChainIssue?.id === issue.id ? (
                      <Button
                        color="gray"
                        onClick={() => onToggleChainIssueDetails(issue.id)}
                        size="xs"
                        variant="outline"
                      >
                        Hide paths
                      </Button>
                    ) : issue.id === 'bucket_only_object' ||
                      issue.id === 'bucket_syfon_no_git' ? (
                      <Button
                        color={issue.color}
                        onClick={() => onToggleChainIssueDetails(issue.id)}
                        size="xs"
                        variant="light"
                      >
                        Select paths
                      </Button>
                    ) : (
                      (() => {
                        const findings = (
                          chainAuditResult?.findings ?? []
                        ).filter((finding) => finding.kind === issue.id);
                        const isShowingPaths =
                          selectedChainIssue?.id === issue.id;
                        const paths = findings.map(
                          (finding) => finding.normalizedPath,
                        );
                        const isMetadataMismatch =
                          issue.id === 'git_syfon_metadata_mismatch';
                        const repairActions = orderedRepairActions(
                          issue.actionSummary.availableActions,
                        ).filter(
                          (action) =>
                            !isMetadataMismatch ||
                            [
                              'delete_syfon_record',
                              'delete_records',
                              'delete_both',
                            ].includes(action.action),
                        );
                        const defaultRepairAction =
                          issue.actionSummary.defaultAction &&
                          repairActions.some(
                            (action) =>
                              action.action ===
                              issue.actionSummary.defaultAction?.action,
                          ) &&
                          ![
                            'view_paths',
                            'inspect_evidence',
                            'rerun_audit',
                          ].includes(issue.actionSummary.defaultAction.action)
                            ? issue.actionSummary.defaultAction
                            : repairActions[0];
                        const secondaryRepairActions =
                          defaultRepairAction && !isMetadataMismatch
                            ? repairActions.filter(
                                (action) =>
                                  action.action !== defaultRepairAction.action,
                              )
                            : [];
                        const isBusy =
                          isApplying ||
                          isAuditing ||
                          isChainAuditing ||
                          isBulkDeletingRecords;
                        const runRepairAction = (action: AuditActionOption) => {
                          onRunIssueAction({
                            defaultAction: action,
                            findings,
                            issueId: issue.id,
                            issueTitle: issue.title,
                            paths,
                            source: 'chain',
                          });
                        };
                        return (
                          <Group gap="xs">
                            {isMetadataMismatch && repairActions.length > 1 ? (
                              <Menu shadow="md" withinPortal>
                                <Menu.Target>
                                  <Button
                                    color={issue.color}
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
                                      key={action.action}
                                      color={
                                        action.destructive ? 'red' : undefined
                                      }
                                      onClick={() => runRepairAction(action)}
                                    >
                                      {action.label}
                                    </Menu.Item>
                                  ))}
                                </Menu.Dropdown>
                              </Menu>
                            ) : defaultRepairAction ? (
                              <Button
                                color={issue.color}
                                loading={isBusy}
                                onClick={() =>
                                  runRepairAction(defaultRepairAction)
                                }
                                size="xs"
                                variant="light"
                              >
                                {defaultRepairAction.label}
                              </Button>
                            ) : null}
                            {secondaryRepairActions.map((action) => (
                              <Button
                                color="gray"
                                key={action.action}
                                loading={isBusy}
                                onClick={() => runRepairAction(action)}
                                size="xs"
                                variant="outline"
                              >
                                {action.label}
                              </Button>
                            ))}
                            <Button
                              color="gray"
                              onClick={() =>
                                onToggleChainIssueDetails(issue.id)
                              }
                              size="xs"
                              variant="outline"
                            >
                              {isShowingPaths ? 'Hide paths' : 'Show paths'}
                            </Button>
                          </Group>
                        );
                      })()
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {selectedChainIssue && actionableChainSelectionIssue ? (
            <Stack
              className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
              gap="sm"
            >
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Text fw={700} size="sm">
                    {selectedChainIssue.title}
                  </Text>
                  <Text c="dimmed" size="sm">
                    Choose the exact paths to act on in this issue set.
                  </Text>
                </div>
                <Button
                  color={selectedChainIssue.color}
                  disabled={selectedChainPaths.length === 0}
                  loading={isApplying || isAuditing}
                  onClick={onApplySelectedChainObjects}
                  size="xs"
                  variant="light"
                >
                  {selectedChainIssue.id === 'bucket_only_object'
                    ? 'Delete selected bucket objects'
                    : 'Delete selected objects'}
                  {selectedChainPaths.length > 0
                    ? ` (${selectedChainPaths.length.toLocaleString()})`
                    : ''}
                </Button>
              </Group>

              <Stack
                className="rounded-md border border-slate-200 bg-white px-3 py-3"
                gap="xs"
              >
                <Group justify="space-between" wrap="wrap">
                  <Checkbox
                    checked={
                      selectableChainPaths.length > 0 &&
                      selectedChainPaths.length === selectableChainPaths.length
                    }
                    indeterminate={
                      selectedChainPaths.length > 0 &&
                      selectedChainPaths.length < selectableChainPaths.length
                    }
                    label={`Select all loaded paths (${selectedChainPaths.length.toLocaleString()} / ${selectableChainPaths.length.toLocaleString()})`}
                    onChange={(event) => {
                      onToggleAllChainPaths(event.currentTarget.checked);
                    }}
                  />
                  <Text c="dimmed" size="xs">
                    Expand folders and choose the exact paths to heal.
                  </Text>
                </Group>
                <ChainPathTree
                  expandedTreeNodes={expandedChainTreeNodes}
                  nodes={chainPathTree.slice(0, treeNodeLimit[''] ?? 100)}
                  onSelectedPathsChange={onSelectedChainPathsChange}
                  onTogglePath={onToggleChainPath}
                  onTreeNodeLimitChange={setTreeNodeLimit}
                  onTreeNodeToggle={setExpandedChainTreeNodes}
                  pathsByParent={pathsByParent}
                  selectedPaths={selectedChainPaths}
                  selectedPathsSet={selectedChainPathsSet}
                  treeNodeLimit={treeNodeLimit}
                />
                {chainPathTree.length > (treeNodeLimit[''] ?? 100) && (
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
                      chainPathTree.length - (treeNodeLimit[''] ?? 100)
                    ).toLocaleString()}{' '}
                    remaining)...
                  </Button>
                )}
              </Stack>
            </Stack>
          ) : null}

          {selectedChainIssue && !actionableChainSelectionIssue ? (
            <Stack
              className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
              gap="sm"
            >
              <div>
                <Text fw={700} size="sm">
                  {selectedChainIssue.title}
                </Text>
                <Text c="dimmed" size="sm">
                  {selectedChainFindings.length.toLocaleString()} paths in this
                  issue set.
                </Text>
              </div>
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
                    {selectedChainFindings.map((finding) => {
                      const evidence = [
                        finding.error,
                        finding.accessUrls[0],
                        finding.bucketObjectUrl,
                        finding.resolvedBucket && finding.resolvedKey
                          ? `${finding.resolvedBucket}/${finding.resolvedKey}`
                          : '',
                      ].find(Boolean);

                      return (
                        <Table.Tr
                          key={`${finding.kind}:${finding.normalizedPath}`}
                        >
                          <Table.Td maw={560}>
                            <Text className="break-all" fw={600} size="sm">
                              {finding.normalizedPath}
                            </Text>
                          </Table.Td>
                          <Table.Td maw={260}>
                            <Text className="break-all font-mono" size="xs">
                              {finding.checksum || '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td maw={520}>
                            <Text className="break-all" size="xs">
                              {evidence || '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {finding.recordCount.toLocaleString()}
                          </Table.Td>
                          <Table.Td>
                            {finding.objectIds.length.toLocaleString()}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </div>
            </Stack>
          ) : null}
        </Stack>
      ) : chainAuditResult ? (
        <Alert
          color="green"
          icon={<IconAlertCircle size={16} />}
          title="No chain issues"
        >
          Gecko did not find any broken Git-to-Syfon-to-bucket links in this
          subtree.
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

      {auditError ? (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          title="Delete preparation failed"
        >
          {auditError}
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

      {showDiffDetails && diffAuditResult ? (
        diffIssueSummaries.length > 0 ? (
          <Stack gap="sm">
            <div>
              <Title order={5}>Project Diff</Title>
              <Text c="dimmed" mt={4} size="sm">
                Checksum join evidence between Git and Syfon.
              </Text>
            </div>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Issue</Table.Th>
                  <Table.Th>Impact</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {diffIssueSummaries.map((issue) => (
                  <Table.Tr key={issue.id}>
                    <Table.Td miw={520}>
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
                        <Text size="sm">{issue.recommendation}</Text>
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
                      {(() => {
                        const findings = (
                          diffAuditResult?.findings ?? []
                        ).filter((finding) =>
                          issue.findingKinds.includes(finding.kind),
                        );
                        const action = resolveIssueAction({
                          defaultAction: issue.actionSummary.defaultAction,
                          findings,
                          issueId: issue.id,
                        });
                        return action ? (
                          <Button
                            color={issue.color}
                            loading={isAuditing}
                            onClick={() => {
                              onRunIssueAction({
                                defaultAction: action,
                                findings,
                                issueId: issue.id,
                                issueTitle: issue.title,
                                paths: findings.map(
                                  (finding) => finding.normalizedPath,
                                ),
                                source: 'diff',
                              });
                            }}
                            size="xs"
                            variant="light"
                          >
                            {action.label}
                          </Button>
                        ) : null;
                      })()}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {selectedDiffIssue ? (
              <Stack
                className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
                gap="sm"
              >
                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Text fw={700} size="sm">
                      {selectedDiffIssue.title}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {selectedDiffFindings.length.toLocaleString()} paths in
                      this issue set.
                    </Text>
                  </div>
                  <Button
                    onClick={() => onSelectedDiffIssueChange(null)}
                    size="xs"
                    variant="subtle"
                  >
                    Hide paths
                  </Button>
                </Group>

                <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200 bg-white">
                  <Table highlightOnHover stickyHeader>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Path</Table.Th>
                        <Table.Th>Issue</Table.Th>
                        <Table.Th>Records</Table.Th>
                        <Table.Th>Objects</Table.Th>
                        <Table.Th>Downloads</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {selectedDiffFindings.map((finding) => (
                        <Table.Tr
                          key={`${finding.kind}:${finding.normalizedPath}`}
                        >
                          <Table.Td maw={720}>
                            <Text className="break-all" fw={600} size="sm">
                              {finding.normalizedPath}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={issueColorForDiffKind(finding.kind)}
                              variant="light"
                            >
                              {formatCleanupFindingLabel(finding.kind)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {finding.recordCount.toLocaleString()}
                          </Table.Td>
                          <Table.Td>
                            {finding.objectIds.length.toLocaleString()}
                          </Table.Td>
                          <Table.Td>
                            {(finding.downloadCount ?? 0).toLocaleString()}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </Stack>
            ) : null}
          </Stack>
        ) : (
          <Alert
            color="green"
            icon={<IconAlertCircle size={16} />}
            title="No project diff issues"
          >
            Git and Syfon are aligned for this subtree. No duplicate,
            Syfon-only, or Git-only paths were returned.
          </Alert>
        )
      ) : null}

      {showCleanupDetails &&
      auditResult &&
      isDuplicateVerificationContext &&
      !hasSafeDuplicateCleanup ? (
        <Alert
          color="yellow"
          icon={<IconAlertCircle size={16} />}
          title="No safe duplicate delete yet"
        >
          Syfon confirmed duplicate paths, but this verification pass did not
          prove which sibling record is stale.
        </Alert>
      ) : null}

      {auditResult && showCleanupDetails ? (
        <Stack gap="sm">
          <div>
            <Title order={5}>Storage Verification</Title>
            <Text c="dimmed" mt={4} size="sm">
              Syfon verification results for the issue set you just inspected.
            </Text>
          </div>

          {hasCleanupFindings && cleanupIssueSummaries.length > 0 ? (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Verification Result</Table.Th>
                  <Table.Th>Impact</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cleanupIssueSummaries.map((issue) => (
                  <Table.Tr key={issue.id}>
                    <Table.Td miw={260}>
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
                    <Table.Td miw={340}>
                      {(() => {
                        const findings = (auditResult?.findings ?? []).filter(
                          (finding) =>
                            issue.findingKinds.includes(finding.kind),
                        );
                        const action = resolveIssueAction({
                          defaultAction: issue.actionSummary.defaultAction,
                          findings,
                          issueId: issue.id,
                        });
                        return action ? (
                          <Button
                            color={issue.color}
                            loading={isApplying}
                            onClick={() => {
                              onRunIssueAction({
                                defaultAction: action,
                                findings,
                                issueId: issue.id,
                                issueTitle: issue.title,
                                paths: findings.map(
                                  (finding) => finding.normalizedPath,
                                ),
                                source: 'cleanup',
                              });
                            }}
                            size="xs"
                            variant="light"
                          >
                            {action.label}
                          </Button>
                        ) : null;
                      })()}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Alert
              color="blue"
              icon={<IconAlertCircle size={16} />}
              title="No delete candidates after verification"
            >
              Storage verification did not return any safe cleanup findings for
              the selected issue set.
            </Alert>
          )}
        </Stack>
      ) : null}
    </Stack>
  </Modal>
);
