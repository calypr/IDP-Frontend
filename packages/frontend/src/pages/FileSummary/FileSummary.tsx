import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  useBulkDeleteSyfonDrsObjectsMutation,
  CALYPR_EXPLORER_CONFIG_API,
} from '@gen3/core';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconRefresh,
  IconSelector,
} from '@tabler/icons-react';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout, ProjectWorkspaceTabs } from '../../features/Navigation';
import { formatBytes } from '../../utils/labels';
import { FileSummaryPageProps } from './types';
import {
  type AuditActionOption,
  type ProjectDiffFinding,
  type ProjectDiffFindingKind,
  type StorageApplyActionRequest,
  type StorageChainFinding,
  type StorageChainFindingKind,
  type StorageChainIssueGroup,
  type StorageCleanupApplyResult,
  type StorageCleanupFinding,
  type StorageCleanupFindingKind,
  useSyfonProjectDiff,
  useSyfonStorageChain,
  useSyfonPathStorageSummary,
  useSyfonStorageCleanup,
} from './hooks';
import {
  buildProjectOptions,
  splitProjectSelectionValue,
  type StoragePathRow,
} from './storageUtils';
import { StorageBrowser } from './StorageBrowser';
import { StorageChainAuditModal } from './StorageChainAuditModal';
import { StorageChainAuditReport } from './StorageChainAuditReport';
import {
  summarizeCleanupIssues,
  summarizeProjectDiffIssues,
  summarizeStorageChainIssues,
} from './storageIssueSummaries';
import {
  buildPathsByParentMap,
  getPathSegments,
  isInspectAction,
  resolveIssueAction,
  resolveProjectSelection,
  sortStorageRowsBy,
  type ActionIssueSource,
  type ActionableFinding,
  type BreadcrumbItem,
  type StorageSortDirection,
  type StorageSortKey,
} from './storagePresentation';

export const FileSummaryPage = ({
  headerProps,
  footerProps,
  filesummaryConfig,
}: FileSummaryPageProps) => {
  const router = useRouter();
  const routeOrganization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const routeProject =
    typeof router.query.project === 'string' ? router.query.project : '';
  const isProjectScopedRoute = Boolean(routeOrganization && routeProject);
  const forcedProjectSelection = isProjectScopedRoute
    ? `${routeOrganization}/${routeProject}`
    : '';
  const [projectOptions, setProjectOptions] = useState<
    Array<ReturnType<typeof buildProjectOptions>[number]>
  >([]);
  const [isProjectsLoading, setIsProjectsLoading] =
    useState(!isProjectScopedRoute);
  const defaultSelection = useMemo(() => {
    if (forcedProjectSelection) {
      return forcedProjectSelection;
    }
    return resolveProjectSelection({
      defaultProject: filesummaryConfig?.defaultProject,
      options: projectOptions,
    });
  }, [
    filesummaryConfig?.defaultProject,
    forcedProjectSelection,
    projectOptions,
  ]);
  const [selectedProject, setSelectedProject] = useState('');
  const [currentPath, setCurrentPath] = useState(
    filesummaryConfig?.defaultPath?.trim() ?? '',
  );
  const [selectedChainIssueId, setSelectedChainIssueId] = useState<
    string | null
  >(null);
  const [selectedDiffIssueId, setSelectedDiffIssueId] = useState<string | null>(
    null,
  );
  const [showCleanupDetails, setShowCleanupDetails] = useState(false);
  const [showDiffDetails, setShowDiffDetails] = useState(false);
  const [selectedChainPathsByIssue, setSelectedChainPathsByIssue] = useState<
    Record<string, Array<string>>
  >({});
  const [expandedChainTreeNodes, setExpandedChainTreeNodes] = useState<
    Record<string, boolean>
  >({});
  const [treeNodeLimit, setTreeNodeLimit] = useState<Record<string, number>>(
    {},
  );
  const [actionFeedbackMessage, setActionFeedbackMessage] = useState<
    string | null
  >(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [showChainAuditReport, setShowChainAuditReport] = useState(false);
  const [isBulkDeletingRecords, setIsBulkDeletingRecords] = useState(false);
  const [storageSortKey, setStorageSortKey] =
    useState<StorageSortKey>('sizeBytes');
  const [storageSortDirection, setStorageSortDirection] =
    useState<StorageSortDirection>('desc');

  useEffect(() => {
    if (isProjectScopedRoute) {
      setProjectOptions([]);
      setIsProjectsLoading(false);
      return;
    }

    let cancelled = false;

    const loadProjectOptions = async () => {
      setIsProjectsLoading(true);
      try {
        const response = await fetch(
          `${CALYPR_EXPLORER_CONFIG_API}/projects/summary`,
          {
            credentials: 'include',
            method: 'GET',
          },
        );

        if (response.status === 401 || response.status === 403) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!response.ok) {
          throw new Error('Failed to load project list.');
        }

        const summary = (await response.json()) as Array<{
          organization: string;
          project: string;
        }>;

        if (!cancelled) {
          setProjectOptions(buildProjectOptions(summary));
        }
      } catch {
        if (!cancelled) {
          setProjectOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsProjectsLoading(false);
        }
      }
    };

    void loadProjectOptions();

    return () => {
      cancelled = true;
    };
  }, [isProjectScopedRoute]);

  useEffect(() => {
    if (forcedProjectSelection) {
      setSelectedProject((current) =>
        current === forcedProjectSelection ? current : forcedProjectSelection,
      );
      return;
    }

    if (!selectedProject && defaultSelection) {
      setSelectedProject(defaultSelection);
    }
  }, [defaultSelection, forcedProjectSelection, selectedProject]);

  const selectedProjectParts = useMemo(
    () => splitProjectSelectionValue(selectedProject),
    [selectedProject],
  );
  const breadcrumbSegments = useMemo(
    () => getPathSegments(currentPath),
    [currentPath],
  );
  const breadcrumbItems = useMemo<Array<BreadcrumbItem>>(() => {
    if (!selectedProjectParts) {
      return [];
    }

    return [
      {
        label: selectedProjectParts.project,
        path: '',
      },
      ...breadcrumbSegments.map((segment, index) => ({
        label: segment,
        path: breadcrumbSegments.slice(0, index + 1).join('/'),
      })),
    ];
  }, [breadcrumbSegments, selectedProjectParts]);
  const collapsedBreadcrumb = useMemo(() => {
    if (breadcrumbItems.length <= 5) {
      return {
        leadingItems: breadcrumbItems,
        hiddenItems: [] as Array<BreadcrumbItem>,
      };
    }

    return {
      leadingItems: [breadcrumbItems[0], ...breadcrumbItems.slice(-4)],
      hiddenItems: breadcrumbItems.slice(1, -4),
    };
  }, [breadcrumbItems]);
  const {
    applyExactChainSummary,
    data,
    error,
    isLoading,
    isLoadingMore,
    loadMore,
    refresh,
  } = useSyfonPathStorageSummary({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    auditError: chainAuditError,
    auditResult: chainAuditResult,
    clearAudit: clearChainAudit,
    isAuditing: isChainAuditing,
    runAudit: runChainAudit,
    setAuditResult: setChainAuditResult,
  } = useSyfonStorageChain({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    auditResult: diffAuditResult,
    clearAudit: clearDiffAudit,
    isAuditing: isDiffAuditing,
    runAudit: runProjectDiffAudit,
  } = useSyfonProjectDiff({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    applyCleanup,
    applyError,
    applyResult,
    auditError,
    auditResult,
    clearCleanupResults,
    isApplying,
    isAuditing,
    rerunAudit,
    runAudit,
  } = useSyfonStorageCleanup({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const [bulkDeleteSyfonDrsObjects] = useBulkDeleteSyfonDrsObjectsMutation();

  useEffect(() => {
    clearChainAudit();
    clearDiffAudit();
    clearCleanupResults();
  }, [
    clearChainAudit,
    clearCleanupResults,
    clearDiffAudit,
    currentPath,
    selectedProject,
  ]);

  useEffect(() => {
    setActionFeedbackMessage(null);
    setSelectedChainIssueId(null);
    setSelectedDiffIssueId(null);
    setShowCleanupDetails(false);
    setShowDiffDetails(false);
    setSelectedChainPathsByIssue({});
    setExpandedChainTreeNodes({});
    setTreeNodeLimit({});
    setShowChainAuditReport(false);
  }, [auditResult?.pathPrefix, currentPath, selectedProject]);

  const pageTitle = selectedProjectParts
    ? `${selectedProjectParts.organization}/${selectedProjectParts.project}`
    : 'Storage Monitor';
  const sortedRows = useMemo(
    () =>
      sortStorageRowsBy(data?.rows ?? [], storageSortKey, storageSortDirection),
    [data?.rows, storageSortDirection, storageSortKey],
  );
  const largestRowSize = useMemo(
    () => Math.max(0, ...(data?.rows ?? []).map((row) => row.sizeBytes)),
    [data?.rows],
  );
  const diffIssueSummaries = useMemo(
    () => summarizeProjectDiffIssues(diffAuditResult?.findings ?? []),
    [diffAuditResult?.findings],
  );
  const chainIssueSummaries = useMemo(
    () =>
      summarizeStorageChainIssues({
        chainFindings: chainAuditResult?.findings ?? [],
        chainGroups: chainAuditResult?.groups ?? [],
      }),
    [chainAuditResult?.findings, chainAuditResult?.groups],
  );
  const cleanChainJoinCount =
    chainAuditResult?.summary.countsByKind.bucket_syfon_git_complete ?? 0;
  const hasChainIssues = chainIssueSummaries.length > 0;
  const selectedChainIssue = useMemo(
    () =>
      chainIssueSummaries.find((issue) => issue.id === selectedChainIssueId) ??
      null,
    [chainIssueSummaries, selectedChainIssueId],
  );
  const selectedChainFindings = useMemo(
    () =>
      selectedChainIssue
        ? (chainAuditResult?.findings ?? []).filter(
            (finding) => finding.kind === selectedChainIssue.id,
          )
        : [],
    [chainAuditResult?.findings, selectedChainIssue],
  );
  const actionableChainSelectionIssue =
    selectedChainIssue?.id === 'bucket_only_object' ||
    selectedChainIssue?.id === 'bucket_syfon_no_git';
  const selectableChainPaths = useMemo(
    () =>
      actionableChainSelectionIssue
        ? Array.from(
            new Set(
              selectedChainFindings
                .map((finding) => finding.normalizedPath)
                .filter(Boolean),
            ),
          ).sort()
        : [],
    [actionableChainSelectionIssue, selectedChainFindings],
  );
  const selectedChainPaths = useMemo(
    () =>
      actionableChainSelectionIssue
        ? (selectedChainPathsByIssue[selectedChainIssue?.id ?? ''] ?? [])
        : [],
    [
      actionableChainSelectionIssue,
      selectedChainIssue?.id,
      selectedChainPathsByIssue,
    ],
  );
  const pathsByParent = useMemo(
    () => buildPathsByParentMap(selectableChainPaths),
    [selectableChainPaths],
  );
  const selectedChainPathsSet = useMemo(
    () => new Set(selectedChainPaths),
    [selectedChainPaths],
  );
  const selectedChainApplyFindings = useMemo(
    () =>
      selectedChainFindings.filter((finding) =>
        selectedChainPathsSet.has(finding.normalizedPath),
      ),
    [selectedChainFindings, selectedChainPathsSet],
  );
  const chainPathTree = useMemo(
    () => pathsByParent.get('') ?? [],
    [pathsByParent],
  );
  const selectedDiffIssue =
    diffIssueSummaries.find((issue) => issue.id === selectedDiffIssueId) ??
    null;
  const selectedDiffFindings = useMemo(
    () =>
      selectedDiffIssue
        ? (diffAuditResult?.findings ?? []).filter((finding) =>
            selectedDiffIssue.findingKinds.includes(finding.kind),
          )
        : [],
    [diffAuditResult?.findings, selectedDiffIssue],
  );
  const cleanupIssueSummaries = useMemo(
    () => summarizeCleanupIssues(auditResult?.findings ?? []),
    [auditResult?.findings],
  );
  const hasCleanupFindings = (auditResult?.summary.totalFindings ?? 0) > 0;
  const isDuplicateVerificationContext =
    selectedDiffIssue?.id === 'duplicate-syfon-paths';
  const hasSafeDuplicateCleanup = cleanupIssueSummaries.some(
    (issue) => issue.id === 'stale-duplicates',
  );

  useEffect(() => {
    if (!actionableChainSelectionIssue || !selectedChainIssue) {
      return;
    }
    setSelectedChainPathsByIssue((current) => {
      const existing = current[selectedChainIssue.id];
      const available = new Set(selectableChainPaths);
      const next = (existing ?? []).filter((path) => available.has(path));
      if (
        existing &&
        existing.length === next.length &&
        existing.every((value, index) => value === next[index])
      ) {
        return current;
      }
      return {
        ...current,
        [selectedChainIssue.id]: next,
      };
    });
  }, [actionableChainSelectionIssue, selectableChainPaths, selectedChainIssue]);
  const buildActionRequests = useCallback(
    ({
      action,
      findings,
    }: {
      action: string;
      findings: Array<ActionableFinding>;
    }): Array<StorageApplyActionRequest> =>
      Array.from(
        new Map(
          findings
            .filter((finding) => finding.normalizedPath)
            .map((finding) => [
              `${finding.kind}:${finding.normalizedPath}:${action}`,
              {
                action,
                kind: finding.kind,
                normalized_path: finding.normalizedPath,
              },
            ]),
        ).values(),
      ),
    [],
  );

  const removeHealedChainFindings = useCallback(
    (issueId: string, paths: Array<string>, deletedRecordCount = 0) => {
      const pathSet = new Set(paths);
      setChainAuditResult((current) => {
        if (!current) {
          return current;
        }

        const findings = current.findings.filter(
          (finding) =>
            !(finding.kind === issueId && pathSet.has(finding.normalizedPath)),
        );

        const countsByKind = Object.keys(current.summary.countsByKind).reduce<
          Record<string, number>
        >((accumulator, key) => {
          accumulator[key] = 0;
          return accumulator;
        }, {});
        countsByKind.bucket_syfon_git_complete =
          current.summary.countsByKind.bucket_syfon_git_complete ?? 0;

        findings.forEach((finding) => {
          countsByKind[finding.kind] = (countsByKind[finding.kind] ?? 0) + 1;
        });

        const groupsMap = new Map<
          string,
          {
            findingCount: number;
            objectIds: Set<string>;
            pathCount: number;
            recordCount: number;
            totalBytes: number;
          }
        >();

        findings.forEach((finding) => {
          const existing = groupsMap.get(finding.kind) ?? {
            findingCount: 0,
            objectIds: new Set<string>(),
            pathCount: 0,
            recordCount: 0,
            totalBytes: 0,
          };
          existing.findingCount += 1;
          existing.pathCount += 1;
          existing.recordCount += finding.recordCount;
          existing.totalBytes += finding.sizeBytes ?? 0;
          finding.objectIds.forEach((objectId) =>
            existing.objectIds.add(objectId),
          );
          groupsMap.set(finding.kind, existing);
        });

        const groups = current.groups
          .map((group) => {
            const updated = groupsMap.get(group.kind);
            if (!updated) {
              return null;
            }

            return {
              kind: group.kind,
              findingCount: updated.findingCount,
              objectCount: updated.objectIds.size,
              pathCount: updated.pathCount,
              recordCount: updated.recordCount,
              totalBytes: updated.totalBytes,
            };
          })
          .filter(
            (group): group is NonNullable<typeof group> => group !== null,
          );

        return {
          ...current,
          findings,
          groups,
          summary: {
            ...current.summary,
            countsByKind,
            syfonRecordCount: Math.max(
              0,
              current.summary.syfonRecordCount - deletedRecordCount,
            ),
            totalFindings: findings.length,
          },
        };
      });
      setSelectedChainIssueId((current) =>
        current === issueId ? null : current,
      );
    },
    [setChainAuditResult],
  );

  const handleBulkDeleteSyfonRecords = useCallback(
    async ({
      findings,
      issueTitle,
      paths,
    }: {
      findings: Array<ActionableFinding>;
      issueTitle: string;
      paths: Array<string>;
    }) => {
      const objectIds = Array.from(
        new Set(
          findings.flatMap((finding) =>
            'objectIds' in finding && Array.isArray(finding.objectIds)
              ? finding.objectIds
              : [],
          ),
        ),
      ).filter(Boolean);

      if (objectIds.length === 0) {
        setActionFeedbackMessage(
          `${issueTitle} did not include any Syfon record ids to delete.`,
        );
        return;
      }

      const approved = window.confirm(
        `Delete ${objectIds.length.toLocaleString()} Syfon record${objectIds.length === 1 ? '' : 's'} across ${paths.length.toLocaleString()} path${paths.length === 1 ? '' : 's'}?\n\nThis removes Syfon metadata only. Bucket objects will not be deleted.`,
      );
      if (!approved) {
        return;
      }

      try {
        setIsBulkDeletingRecords(true);
        await bulkDeleteSyfonDrsObjects({
          bulk_object_ids: objectIds,
          delete_object_metadata: true,
          delete_storage_data: false,
        }).unwrap();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Syfon record deletion failed.';
        setActionFeedbackMessage(message);
        return;
      } finally {
        setIsBulkDeletingRecords(false);
      }

      setActionFeedbackMessage(
        `Deleted ${objectIds.length.toLocaleString()} Syfon record${objectIds.length === 1 ? '' : 's'} across ${paths.length.toLocaleString()} path${paths.length === 1 ? '' : 's'}.`,
      );
      setSelectedChainIssueId(null);
      removeHealedChainFindings(
        findings[0] && 'kind' in findings[0] ? findings[0].kind : '',
        paths,
        objectIds.length,
      );
      refresh();
    },
    [bulkDeleteSyfonDrsObjects, refresh, removeHealedChainFindings],
  );

  const runIssueAction = useCallback(
    async ({
      defaultAction,
      findings,
      issueId,
      issueTitle,
      paths,
      source,
    }: {
      defaultAction?: AuditActionOption;
      findings: Array<ActionableFinding>;
      issueId: string;
      issueTitle: string;
      paths: Array<string>;
      source: ActionIssueSource;
    }) => {
      const resolvedAction = resolveIssueAction({
        defaultAction,
        findings,
        issueId,
      });

      if (!resolvedAction) {
        setActionFeedbackMessage(
          `${issueTitle} does not currently expose any backend action.`,
        );
        return;
      }

      const actionName = resolvedAction.action;
      const selectedPaths = paths;

      if (isInspectAction(actionName)) {
        if (source === 'diff') {
          setSelectedDiffIssueId(issueId);
          setShowDiffDetails(true);
        }
        if (source === 'chain') {
          setSelectedChainIssueId(issueId);
        }
        return;
      }

      if (actionName === 'rerun_audit') {
        if (source === 'chain') {
          await runChainAudit();
        } else {
          await rerunAudit();
        }
        return;
      }

      if (actionName === 'delete_records') {
        await handleBulkDeleteSyfonRecords({
          findings,
          issueTitle,
          paths: selectedPaths,
        });
        return;
      }

      if (
        actionName === 'verify_duplicates' ||
        actionName === 'prepare_delete'
      ) {
        if (source === 'diff') {
          setSelectedDiffIssueId(issueId);
        }
        setShowCleanupDetails(true);
        const result = await runAudit({
          includeRepoManifest: true,
          selectedPaths,
        });
        if (result) {
          const verifiedPathCount = new Set(
            result.findings
              .map((finding) => finding.normalizedPath)
              .filter(Boolean),
          ).size;
          setActionFeedbackMessage(
            result.summary.totalFindings > 0
              ? `${resolvedAction.label} returned ${result.summary.totalFindings.toLocaleString()} cleanup finding${result.summary.totalFindings === 1 ? '' : 's'} across ${verifiedPathCount.toLocaleString()} path${verifiedPathCount === 1 ? '' : 's'}.`
              : `${resolvedAction.label} completed, but Syfon did not return any cleanup findings for these paths.`,
          );
        }
        return;
      }

      if (resolvedAction.requiresConfirmation || resolvedAction.destructive) {
        let approved = true;
        if (resolvedAction.supportsDryRun) {
          const preview = await applyCleanup({
            actions: buildActionRequests({
              action: actionName,
              findings,
            }),
            findings: findings.filter(
              (
                finding,
              ): finding is StorageCleanupFinding | StorageChainFinding =>
                'records' in finding,
            ),
            deleteBucketOnlyObjects: false,
            deleteRepoOrphans: false,
            deleteStaleDuplicates: false,
            dryRun: true,
            selectedPaths,
          });

          if (!preview) {
            return;
          }

          approved = window.confirm(
            `${resolvedAction.label}\n\nDelete records: ${preview.deletedRecordIds.length.toLocaleString()}\nDelete bucket objects: ${preview.deletedBucketObjectUrls.length.toLocaleString()}\nSkipped paths: ${preview.skippedPaths.length.toLocaleString()}\n\nProceed?`,
          );
        } else {
          approved = window.confirm(
            `${resolvedAction.label}\n\nThis action will modify project state. Proceed?`,
          );
        }

        if (!approved) {
          return;
        }
      }

      const result = await applyCleanup({
        actions: buildActionRequests({
          action: actionName,
          findings,
        }),
        findings: findings.filter(
          (finding): finding is StorageCleanupFinding | StorageChainFinding =>
            'records' in finding,
        ),
        deleteBucketOnlyObjects: false,
        deleteRepoOrphans: false,
        deleteStaleDuplicates: false,
        dryRun: false,
        selectedPaths,
      });

      if (!result) {
        return;
      }

      setActionFeedbackMessage(
        `${resolvedAction.label} completed for ${selectedPaths.length.toLocaleString()} path${selectedPaths.length === 1 ? '' : 's'}.`,
      );
      if (source === 'chain') {
        removeHealedChainFindings(
          issueId,
          selectedPaths,
          result.deletedRecordIds.length,
        );
        refresh();
        return;
      }
      refresh();
    },
    [
      applyCleanup,
      buildActionRequests,
      handleBulkDeleteSyfonRecords,
      removeHealedChainFindings,
      refresh,
      resolveIssueAction,
      rerunAudit,
      runChainAudit,
      runAudit,
    ],
  );

  const handleToggleChainIssueDetails = useCallback((issueId: string) => {
    setSelectedChainIssueId((current) =>
      current === issueId ? null : issueId,
    );
  }, []);

  const handleRunStorageChainAudit = async () => {
    const result = await runChainAudit();
    setShowChainAuditReport(true);
    if (!result) {
      return;
    }

    applyExactChainSummary({
      bucketObjectCount: result.summary.bucketObjectCount,
      gitTrackedFileCount: result.summary.gitTrackedFileCount,
      pathPrefix: result.pathPrefix,
      syfonRecordCount: result.summary.syfonRecordCount,
    });
  };

  const handleOpenChainIssueDetails = (issueId: string) => {
    setSelectedChainIssueId(issueId);
    setShowChainAuditReport(true);
    setAuditModalOpen(true);
  };

  const handleStorageSort = (key: StorageSortKey) => {
    setStorageSortDirection((currentDirection) =>
      storageSortKey === key
        ? currentDirection === 'asc'
          ? 'desc'
          : 'asc'
        : key === 'name' || key === 'type'
          ? 'asc'
          : 'desc',
    );
    setStorageSortKey(key);
  };

  const setSelectedChainPathsForIssue = useCallback(
    (paths: Array<string>) => {
      if (!selectedChainIssue) {
        return;
      }
      setSelectedChainPathsByIssue((current) => ({
        ...current,
        [selectedChainIssue.id]: Array.from(new Set(paths)).sort(),
      }));
    },
    [selectedChainIssue],
  );

  const handleToggleAllChainPaths = useCallback(
    (checked: boolean) => {
      if (!actionableChainSelectionIssue) {
        return;
      }
      setSelectedChainPathsForIssue(checked ? selectableChainPaths : []);
    },
    [
      actionableChainSelectionIssue,
      selectableChainPaths,
      setSelectedChainPathsForIssue,
    ],
  );

  const handleToggleChainPath = useCallback(
    (path: string, checked: boolean) => {
      const next = checked
        ? [...selectedChainPaths, path]
        : selectedChainPaths.filter((value) => value !== path);
      setSelectedChainPathsForIssue(next);
    },
    [selectedChainPaths, setSelectedChainPathsForIssue],
  );

  const handleApplySelectedChainObjects = useCallback(async () => {
    if (!selectedChainIssue || selectedChainPaths.length === 0) {
      return;
    }

    const isBucketOnlyIssue = selectedChainIssue.id === 'bucket_only_object';
    const isBucketSyfonNoGitIssue =
      selectedChainIssue.id === 'bucket_syfon_no_git';
    if (!isBucketOnlyIssue && !isBucketSyfonNoGitIssue) {
      return;
    }

    const approved = window.confirm(
      isBucketOnlyIssue
        ? `Delete ${selectedChainPaths.length.toLocaleString()} selected bucket-only path${selectedChainPaths.length === 1 ? '' : 's'}?\n\nThis will ask Syfon to delete the bucket objects in one bulk request.`
        : `Delete ${selectedChainPaths.length.toLocaleString()} selected Bucket + Syfon, No Git path${selectedChainPaths.length === 1 ? '' : 's'}?\n\nThis will ask Syfon to delete both the Syfon records and bucket objects in one bulk request.`,
    );
    if (!approved) {
      return;
    }

    const result = await applyCleanup({
      deleteBucketOnlyObjects: isBucketOnlyIssue,
      deleteRepoOrphans: isBucketSyfonNoGitIssue,
      deleteStaleDuplicates: false,
      findings: selectedChainApplyFindings,
      dryRun: false,
      selectedPaths: selectedChainPaths,
    });

    if (!result) {
      return;
    }

    setActionFeedbackMessage(
      isBucketOnlyIssue
        ? `Deleted ${selectedChainPaths.length.toLocaleString()} selected bucket-only path${selectedChainPaths.length === 1 ? '' : 's'} in one Syfon bulk request.`
        : `Deleted ${selectedChainPaths.length.toLocaleString()} selected Bucket + Syfon, No Git path${selectedChainPaths.length === 1 ? '' : 's'} in one Syfon bulk request.`,
    );
    removeHealedChainFindings(
      selectedChainIssue.id,
      selectedChainPaths,
      result.deletedRecordIds.length,
    );
    refresh();
  }, [
    applyCleanup,
    removeHealedChainFindings,
    refresh,
    selectedChainApplyFindings,
    selectedChainIssue,
    selectedChainPaths,
  ]);

  const pageContent = (
    <div className="min-h-screen bg-[#f6f8fa]">
      <Container className="max-w-[1680px]" py="xl" size="100%">
        <Stack gap="lg">
          <Stack gap="md" px="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>Storage Monitor</Title>
                <Text c="dimmed" mt={4} size="sm">
                  Gecko-backed storage view by project path using repository
                  analytics plus Syfon-backed object verification.
                </Text>
              </div>
            </Group>

            {!isProjectScopedRoute ? (
              <Select
                data={projectOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
                disabled={isProjectsLoading || projectOptions.length === 0}
                label="Project"
                onChange={(value) => {
                  setSelectedProject(value ?? '');
                  setCurrentPath(filesummaryConfig?.defaultPath?.trim() ?? '');
                }}
                placeholder="Select a project"
                searchable
                value={selectedProject}
              />
            ) : null}

            {!selectedProject && !isProjectsLoading && !isProjectScopedRoute ? (
              <Alert
                color="yellow"
                icon={<IconAlertCircle size={16} />}
                title="No projects"
              >
                No Gecko projects are available for this storage monitor.
              </Alert>
            ) : null}

            {error ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={16} />}
                title="Storage load failed"
              >
                {error}
              </Alert>
            ) : null}
          </Stack>

          {isProjectsLoading || isLoading ? (
            <Center h="45vh">
              <Loader size={32} />
            </Center>
          ) : selectedProjectParts ? (
            <>
              <StorageChainAuditModal
                actionFeedbackMessage={actionFeedbackMessage}
                actionableChainSelectionIssue={actionableChainSelectionIssue}
                applyError={applyError}
                applyResult={applyResult}
                auditError={auditError}
                auditResult={auditResult}
                chainAuditError={chainAuditError}
                chainAuditResult={chainAuditResult}
                chainIssueSummaries={chainIssueSummaries}
                chainPathTree={chainPathTree}
                cleanChainJoinCount={cleanChainJoinCount}
                cleanupIssueSummaries={cleanupIssueSummaries}
                diffAuditResult={diffAuditResult}
                diffIssueSummaries={diffIssueSummaries}
                expandedChainTreeNodes={expandedChainTreeNodes}
                hasChainIssues={hasChainIssues}
                hasCleanupFindings={hasCleanupFindings}
                hasSafeDuplicateCleanup={hasSafeDuplicateCleanup}
                isApplying={isApplying}
                isAuditing={isAuditing}
                isBulkDeletingRecords={isBulkDeletingRecords}
                isChainAuditing={isChainAuditing}
                isDuplicateVerificationContext={isDuplicateVerificationContext}
                onApplySelectedChainObjects={() => {
                  void handleApplySelectedChainObjects();
                }}
                onClose={() => setAuditModalOpen(false)}
                onRunIssueAction={(args) => {
                  void runIssueAction(args);
                }}
                onSelectedChainPathsChange={setSelectedChainPathsForIssue}
                onSelectedDiffIssueChange={setSelectedDiffIssueId}
                onToggleAllChainPaths={handleToggleAllChainPaths}
                onToggleChainIssueDetails={handleToggleChainIssueDetails}
                onToggleChainPath={handleToggleChainPath}
                opened={auditModalOpen}
                pathsByParent={pathsByParent}
                selectableChainPaths={selectableChainPaths}
                selectedChainFindings={selectedChainFindings}
                selectedChainIssue={selectedChainIssue}
                selectedChainPaths={selectedChainPaths}
                selectedChainPathsSet={selectedChainPathsSet}
                selectedDiffFindings={selectedDiffFindings}
                selectedDiffIssue={selectedDiffIssue}
                setExpandedChainTreeNodes={setExpandedChainTreeNodes}
                setTreeNodeLimit={setTreeNodeLimit}
                showCleanupDetails={showCleanupDetails}
                showDiffDetails={showDiffDetails}
                treeNodeLimit={treeNodeLimit}
              />

              <StorageBrowser
                auditReport={
                  <StorageChainAuditReport
                    auditError={chainAuditError}
                    auditResult={chainAuditResult}
                    chainIssueSummaries={chainIssueSummaries}
                    cleanChainJoinCount={cleanChainJoinCount}
                    isOpen={showChainAuditReport}
                    onOpenChange={setShowChainAuditReport}
                    onOpenIssueDetails={handleOpenChainIssueDetails}
                  />
                }
                collapsedBreadcrumb={collapsedBreadcrumb}
                currentPath={currentPath}
                data={data}
                filesummaryConfig={filesummaryConfig}
                isChainAuditing={isChainAuditing}
                isLoadingMore={isLoadingMore}
                largestRowSize={largestRowSize}
                onLoadMore={() => {
                  void loadMore();
                }}
                onRunAudit={() => {
                  void handleRunStorageChainAudit();
                }}
                onPathChange={setCurrentPath}
                onRefresh={refresh}
                onSort={handleStorageSort}
                pageTitle={pageTitle}
                selectedProject={selectedProject}
                sortedRows={sortedRows}
                storageSortDirection={storageSortDirection}
                storageSortKey={storageSortKey}
              />
            </>
          ) : null}
        </Stack>
      </Container>
    </div>
  );

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR Storage Monitor',
        content: 'Storage Monitor',
        key: 'calypr-storage-monitor',
      }}
      mainProps={{ className: 'bg-[#f6f8fa]' }}
    >
      <ProtectedContent>
        {isProjectScopedRoute ? (
          <ProjectWorkspaceTabs
            activeTab="storage"
            hasExplorerConfig
            organization={routeOrganization}
            project={routeProject}
          >
            {pageContent}
          </ProjectWorkspaceTabs>
        ) : (
          pageContent
        )}
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default FileSummaryPage;
