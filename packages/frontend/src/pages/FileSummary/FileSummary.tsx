import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  CALYPR_EXPLORER_CONFIG_API,
  useGetConfigContentQuery,
} from '@gen3/core';
import {
  ActionIcon,
  Alert,
  Badge,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconRefresh,
} from '@tabler/icons-react';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout, ProjectWorkspaceTabs } from '../../features/Navigation';
import { FileSummaryPageProps } from './types';
import {
  type AuditActionOption,
  type StorageApplyActionRequest,
  type StorageChainAuditResult,
  type StorageChainFinding,
  type StorageCleanupFinding,
  useSyfonStorageChain,
  useSyfonPathStorageSummary,
  useSyfonStorageCleanup,
  useRegisterGitOnlySyfonRecords,
} from './hooks';
import {
  buildProjectOptions,
  splitProjectSelectionValue,
} from './storageUtils';
import { StorageBrowser } from './StorageBrowser';
import { StorageChainAuditReport } from './StorageChainAuditReport';
import { summarizeStorageChainIssues } from './storageIssueSummaries';
import { getReadableDuration } from '../../utils/time';
import {
  getPathSegments,
  isInspectAction,
  resolveIssueAction,
  resolveProjectSelection,
  sortStorageRowsBy,
  type ActionableFinding,
  type BreadcrumbItem,
  type StorageSortDirection,
  type StorageSortKey,
} from './storagePresentation';

export const FileSummaryPage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
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
      defaultProject: configuration?.defaultProject,
      options: projectOptions,
    });
  }, [
    configuration?.defaultProject,
    forcedProjectSelection,
    projectOptions,
  ]);
  const [selectedProject, setSelectedProject] = useState('');
  const [currentPath, setCurrentPath] = useState(
    configuration?.defaultPath?.trim() ?? '',
  );
  const [hasCopiedStoragePath, setHasCopiedStoragePath] = useState(false);
  const [expandedChainIssueIds, setExpandedChainIssueIds] = useState<
    Set<string>
  >(new Set());
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
  const [chainIssueFindingsByKind, setChainIssueFindingsByKind] = useState<
    Record<string, Array<StorageChainFinding>>
  >({});
  const [chainIssueLoadErrors, setChainIssueLoadErrors] = useState<
    Record<string, string>
  >({});
  const [chainIssueLoadNotices, setChainIssueLoadNotices] = useState<
    Record<string, string>
  >({});
  const [loadingChainIssueId, setLoadingChainIssueId] = useState<string | null>(
    null,
  );
  const [storageSortKey, setStorageSortKey] =
    useState<StorageSortKey>('sizeBytes');
  const [storageSortDirection, setStorageSortDirection] =
    useState<StorageSortDirection>('desc');
  const [exactStorageRequest, setExactStorageRequest] = useState<{
    path: string;
    token: number;
  } | null>(null);
  const [storageTab, setStorageTab] = useState<'browser' | 'audit'>('browser');

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
  const explorerConfigId = selectedProjectParts
    ? `${selectedProjectParts.organization}-${selectedProjectParts.project}`
    : '';
  const { data: explorerConfigResponse } = useGetConfigContentQuery(
    explorerConfigId,
    {
      skip: !explorerConfigId,
    },
  );
  const hasExplorerConfig = Boolean(explorerConfigResponse?.data);
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
    config: configuration ?? undefined,
    currentPath,
    exactRequest: exactStorageRequest ?? undefined,
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
    config: configuration ?? undefined,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    applyCleanup,
    applyError,
    applyResult,
    clearApplyError,
    clearApplyResult,
    clearCleanupResults,
    isApplying,
    isAuditing,
  } = useSyfonStorageCleanup({
    config: configuration ?? undefined,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    error: gitOnlyRegistrationError,
    isRegistering: isRegisteringGitOnly,
    register: registerGitOnlySyfonRecords,
  } = useRegisterGitOnlySyfonRecords({
    projectSelection: selectedProject,
  });
  useEffect(() => {
    clearChainAudit();
    clearCleanupResults();
  }, [clearChainAudit, clearCleanupResults, selectedProject]);

  useEffect(() => {
    setActionFeedbackMessage(null);
    setExpandedChainIssueIds(new Set());
    setSelectedChainPathsByIssue({});
    setExpandedChainTreeNodes({});
    setTreeNodeLimit({});
    setChainIssueFindingsByKind({});
    setChainIssueLoadErrors({});
    setChainIssueLoadNotices({});
    setLoadingChainIssueId(null);
  }, [selectedProject]);

  const sortedRows = useMemo(
    () =>
      sortStorageRowsBy(data?.rows ?? [], storageSortKey, storageSortDirection),
    [data?.rows, storageSortDirection, storageSortKey],
  );
  const largestRowSize = useMemo(
    () => Math.max(0, ...(data?.rows ?? []).map((row) => row.sizeBytes)),
    [data?.rows],
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
  const getChainFindingsForIssue = useCallback(
    (issueId: string): Array<StorageChainFinding> => {
      const fullIssueFindings = chainIssueFindingsByKind[issueId];
      if (fullIssueFindings) {
        return fullIssueFindings;
      }
      return (chainAuditResult?.findings ?? []).filter(
        (finding) => finding.kind === issueId,
      );
    },
    [chainAuditResult?.findings, chainIssueFindingsByKind],
  );
  useEffect(() => {
    setSelectedChainPathsByIssue((current) => {
      let changed = false;
      const nextSelections: Record<string, Array<string>> = {};
      Object.entries(current).forEach(([issueId, selectedPaths]) => {
        const issueIsSelectable =
          issueId === 'bucket_only_object' ||
          issueId === 'bucket_syfon_no_git' ||
          issueId === 'git_only_no_syfon';
        if (!issueIsSelectable) {
          nextSelections[issueId] = selectedPaths;
          return;
        }
        const available = new Set(
          getChainFindingsForIssue(issueId)
            .map((finding) => finding.normalizedPath)
            .filter(Boolean),
        );
        const nextPaths = selectedPaths.filter((path) => available.has(path));
        nextSelections[issueId] = nextPaths;
        if (
          nextPaths.length !== selectedPaths.length ||
          nextPaths.some((value, index) => value !== selectedPaths[index])
        ) {
          changed = true;
        }
      });
      return changed ? nextSelections : current;
    });
  }, [getChainFindingsForIssue]);
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
  const buildSuggestedActionRequests = useCallback(
    ({
      findings,
    }: {
      findings: Array<ActionableFinding>;
    }): Array<StorageApplyActionRequest> =>
      Array.from(
        new Map(
          findings
            .filter(
              (finding) =>
                finding.normalizedPath &&
                'suggestedAction' in finding &&
                finding.suggestedAction,
            )
            .map((finding) => [
              `${finding.kind}:${finding.normalizedPath}:${'suggestedAction' in finding ? finding.suggestedAction : ''}`,
              {
                action:
                  'suggestedAction' in finding && finding.suggestedAction
                    ? finding.suggestedAction
                    : '',
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
      setChainIssueFindingsByKind((current) => {
        const existing = current[issueId];
        if (!existing) {
          return current;
        }

        return {
          ...current,
          [issueId]: existing.filter(
            (finding) => !pathSet.has(finding.normalizedPath),
          ),
        };
      });
      setExpandedChainIssueIds((current) => {
        if (!current.has(issueId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(issueId);
        return next;
      });
    },
    [setChainAuditResult],
  );

  const loadChainIssueDetails = useCallback(
    (issueId: string) => {
      if (chainIssueFindingsByKind[issueId]) {
        return;
      }

      setLoadingChainIssueId(null);
      setChainIssueLoadErrors((current) => {
        const next = { ...current };
        delete next[issueId];
        return next;
      });
      setChainIssueLoadNotices((current) => {
        const next = { ...current };
        delete next[issueId];
        return next;
      });

      if (!chainAuditResult) {
        setChainIssueLoadErrors((current) => ({
          ...current,
          [issueId]:
            'Run the storage chain audit before opening issue details.',
        }));
        return;
      }

      const findings = chainAuditResult.findings.filter(
        (finding) => finding.kind === issueId,
      );
      setChainIssueFindingsByKind((current) => ({
        ...current,
        [issueId]: findings,
      }));

      const expectedCount =
        chainAuditResult.groups.find((group) => group.kind === issueId)
          ?.findingCount ?? findings.length;
      if (expectedCount > findings.length) {
        const findingLimit = chainAuditResult.summary.findingLimit;
        setChainIssueLoadNotices((current) => ({
          ...current,
          [issueId]:
            findings.length > 0
              ? `Showing ${findings.length.toLocaleString()} of ${expectedCount.toLocaleString()} ${expectedCount === 1 ? 'row' : 'rows'} from the completed audit response for this issue group.${findingLimit ? ` Audit responses include up to ${findingLimit.toLocaleString()} rows per issue group.` : ''}`
              : 'The completed audit response did not include row details for this issue group. Rerun the audit after Gecko is updated to return rows per issue group.',
        }));
      } else if (findings.length === 0 && expectedCount > 0) {
        setChainIssueLoadNotices((current) => ({
          ...current,
          [issueId]:
            'The completed audit summarized this issue group but did not include row-level findings for it.',
        }));
      }
    },
    [chainAuditResult, chainIssueFindingsByKind],
  );

  const runIssueAction = useCallback(
    async ({
      defaultAction,
      findings,
      issueId,
      issueTitle,
      paths,
    }: {
      defaultAction?: AuditActionOption;
      findings: Array<ActionableFinding>;
      issueId: string;
      issueTitle: string;
      paths: Array<string>;
    }) => {
      const resolvedAction = resolveIssueAction({
        defaultAction,
        findings,
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
        setExpandedChainIssueIds((current) => {
          const next = new Set(current);
          next.add(issueId);
          return next;
        });
        void loadChainIssueDetails(issueId);
        return;
      }

      if (actionName === 'rerun_audit') {
        await runChainAudit();
        return;
      }

      const suggestedMode = actionName === 'apply_suggested_fixes';
      const actionFindings = suggestedMode
        ? findings.filter(
            (finding) =>
              'suggestedAction' in finding && Boolean(finding.suggestedAction),
          )
        : findings;
      const actionRequests = suggestedMode
        ? buildSuggestedActionRequests({ findings: actionFindings })
        : buildActionRequests({
            action: actionName,
            findings: actionFindings,
          });

      if (suggestedMode && actionRequests.length === 0) {
        setActionFeedbackMessage(
          `${issueTitle} does not currently have any backend-applicable suggested fixes.`,
        );
        return;
      }

      if (resolvedAction.requiresConfirmation || resolvedAction.destructive) {
        let approved = true;
        if (resolvedAction.supportsDryRun) {
          const preview = await applyCleanup({
            actions: actionRequests,
            findings: actionFindings.filter(
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
        actions: actionRequests,
        findings: actionFindings.filter(
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
      removeHealedChainFindings(
        issueId,
        selectedPaths,
        result.deletedRecordIds.length,
      );
      refresh();
    },
    [
      applyCleanup,
      buildActionRequests,
      buildSuggestedActionRequests,
      loadChainIssueDetails,
      removeHealedChainFindings,
      refresh,
      runChainAudit,
    ],
  );

  const handleToggleChainIssueDetails = useCallback(
    (issueId: string) => {
      setExpandedChainIssueIds((current) => {
        const next = new Set(current);
        if (next.has(issueId)) {
          next.delete(issueId);
          return next;
        }
        next.add(issueId);
        void loadChainIssueDetails(issueId);
        return next;
      });
    },
    [loadChainIssueDetails],
  );

  const applyStorageChainAuditSummary = useCallback(
    (result: StorageChainAuditResult | null) => {
      if (!result) {
        return;
      }
      applyExactChainSummary({
        bucketObjectCount: result.summary.bucketObjectCount,
        gitTrackedFileCount: result.summary.gitTrackedFileCount,
        pathPrefix: result.pathPrefix,
        syfonRecordCount: result.summary.syfonRecordCount,
      });
    },
    [applyExactChainSummary],
  );

  useEffect(() => {
    if (!selectedProjectParts || isProjectsLoading) {
      return;
    }

    let cancelled = false;
    void runChainAudit().then((result) => {
      if (!cancelled) {
        applyStorageChainAuditSummary(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
      applyStorageChainAuditSummary,
    currentPath,
    isProjectsLoading,
      runChainAudit,
    selectedProjectParts,
  ]);

  const handleRunStorageChainAudit = async () => {
    setExactStorageRequest((current) => ({
      path: currentPath,
      token: (current?.token ?? 0) + 1,
    }));
    const result = await runChainAudit({
      bucketInventoryMode: 'validate',
      forceAuditRefresh: true,
    });
    applyStorageChainAuditSummary(result);
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

  const formatAuditRefreshTimestamp = (value?: string): string => {
    if (!value) {
      return 'Never';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };
  const breadcrumbLabelClassName =
    'truncate text-[1.1rem] font-semibold leading-tight text-slate-900 hover:text-slate-950';
  const copyCurrentStoragePath = async () => {
    if (!selectedProjectParts || typeof navigator === 'undefined') {
      return;
    }

    await navigator.clipboard.writeText(
      [selectedProjectParts.project, currentPath].filter(Boolean).join('/'),
    );
    setHasCopiedStoragePath(true);
    window.setTimeout(() => setHasCopiedStoragePath(false), 2000);
  };
  const auditLastRefreshedAt = formatAuditRefreshTimestamp(
    chainAuditResult?.summary.auditCachedAt,
  );
  const auditRefreshDuration =
    typeof chainAuditResult?.summary.auditRefreshDurationMs === 'number'
      ? ` in ${getReadableDuration(
          chainAuditResult.summary.auditRefreshDurationMs,
        )}`
      : '';
  const actualChainIssues = chainIssueSummaries.filter(
    (issue) => issue.id !== 'bucket_only_object',
  );
  const auditIssuePathCount = actualChainIssues.reduce(
    (total, issue) => total + issue.pathCount,
    0,
  );
  const browserBreadcrumbs = (
    <Group className="min-w-0 flex-1 overflow-x-auto" gap={8} wrap="nowrap">
      {collapsedBreadcrumb.leadingItems.map((item, index) => (
        <React.Fragment key={item.path || item.label}>
          {index > 0 ? (
            <Text c="dimmed" fw={700} size="sm">
              /
            </Text>
          ) : null}
          {index === 1 && collapsedBreadcrumb.hiddenItems.length > 0 ? (
            <>
              <Menu shadow="md" width={260} withinPortal>
                <Menu.Target>
                  <button
                    className={`${breadcrumbLabelClassName} max-w-[220px] text-slate-500`}
                    type="button"
                  >
                    ...
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  {collapsedBreadcrumb.hiddenItems.map((hiddenItem) => (
                    <Menu.Item
                      key={hiddenItem.path}
                      onClick={() => setCurrentPath(hiddenItem.path)}
                    >
                      {hiddenItem.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
              <Text c="dimmed" fw={700} size="sm">
                /
              </Text>
            </>
          ) : null}
          <button
            className={`${breadcrumbLabelClassName} max-w-[240px] ${
              index === 0
                ? 'text-primary hover:underline'
                : item.path === currentPath
                  ? 'text-slate-900'
                  : 'text-slate-900 hover:text-slate-950'
            }`}
            onClick={() => setCurrentPath(item.path)}
            title={item.label}
            type="button"
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
      <ActionIcon
        aria-label="Copy storage path"
        color={hasCopiedStoragePath ? 'primary.0' : 'gray'}
        onClick={() => {
          void copyCurrentStoragePath();
        }}
        size="sm"
        variant="subtle"
      >
        {hasCopiedStoragePath ? (
          <IconCheck size={16} />
        ) : (
          <IconCopy size={16} />
        )}
      </ActionIcon>
    </Group>
  );
  const auditRefreshUtility = (
    <Group className="ml-auto shrink-0" gap="xs" wrap="nowrap">
      <Text c="dimmed" size="xs">
        Last refreshed: {auditLastRefreshedAt}
        {auditRefreshDuration}
      </Text>
      <ActionIcon
        aria-label="Refresh audit"
        disabled={isChainAuditing}
        loading={isChainAuditing}
        onClick={() => {
          void handleRunStorageChainAudit();
        }}
        size="lg"
        variant="subtle"
      >
        <IconRefresh size={16} />
      </ActionIcon>
    </Group>
  );
  const storageTabToolbar = selectedProjectParts ? (
    <Group
      aria-label="Storage views"
      className="shrink-0 border-l border-slate-200 pl-5"
      gap="md"
      role="tablist"
      wrap="nowrap"
    >
      <button
        aria-selected={storageTab === 'browser'}
        className={`rounded-none border-0 border-b-2 bg-transparent px-0 pb-3 pt-3 text-sm font-semibold transition-colors ${
          storageTab === 'browser'
            ? 'border-[#2f5aac] text-[#2f5aac]'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
        onClick={() => setStorageTab('browser')}
        role="tab"
        type="button"
      >
        Browser
      </button>
      <button
        aria-selected={storageTab === 'audit'}
        className={`rounded-none border-0 border-b-2 bg-transparent px-0 pb-3 pt-3 text-sm font-semibold transition-colors ${
          storageTab === 'audit'
            ? 'border-[#2f5aac] text-[#2f5aac]'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
        onClick={() => setStorageTab('audit')}
        role="tab"
        type="button"
      >
        <Group gap={6} wrap="nowrap">
          <span>Audit</span>
          {chainAuditResult ? (
            <Badge
              color={actualChainIssues.length > 0 ? 'yellow' : 'green'}
              size="xs"
              variant="light"
            >
              {auditIssuePathCount.toLocaleString()}
            </Badge>
          ) : null}
        </Group>
      </button>
    </Group>
  ) : null;

  const setSelectedChainPathsForIssue = useCallback(
    (issueId: string, paths: Array<string>) => {
      setSelectedChainPathsByIssue((current) => ({
        ...current,
        [issueId]: Array.from(new Set(paths)).sort(),
      }));
    },
    [],
  );

  const handleApplySelectedChainObjects = useCallback(
    async (issueId: string) => {
      const targetIssue = chainIssueSummaries.find(
        (issue) => issue.id === issueId,
      );
      if (!targetIssue) {
        return;
      }
      const targetPaths = selectedChainPathsByIssue[targetIssue.id] ?? [];
      if (targetPaths.length === 0) {
        return;
      }
      const targetFindings = getChainFindingsForIssue(targetIssue.id).filter(
        (finding) => targetPaths.includes(finding.normalizedPath),
      );

      const isBucketOnlyIssue = targetIssue.id === 'bucket_only_object';
      const isBucketSyfonNoGitIssue = targetIssue.id === 'bucket_syfon_no_git';
      if (!isBucketOnlyIssue && !isBucketSyfonNoGitIssue) {
        return;
      }

      const approved = window.confirm(
        isBucketOnlyIssue
          ? `Delete ${targetPaths.length.toLocaleString()} selected bucket-only path${targetPaths.length === 1 ? '' : 's'}?\n\nThis will ask Syfon to delete the bucket objects in one bulk request.`
          : `Delete ${targetPaths.length.toLocaleString()} selected Bucket + Syfon, No Git path${targetPaths.length === 1 ? '' : 's'}?\n\nThis will ask Syfon to delete both the Syfon records and bucket objects in one bulk request.`,
      );
      if (!approved) {
        return;
      }

      const result = await applyCleanup({
        deleteBucketOnlyObjects: isBucketOnlyIssue,
        deleteRepoOrphans: isBucketSyfonNoGitIssue,
        deleteStaleDuplicates: false,
        findings: targetFindings,
        dryRun: false,
        selectedPaths: targetPaths,
      });

      if (!result) {
        return;
      }

      const deletedPathCount = isBucketOnlyIssue
        ? result.deletedBucketObjectUrls.length
        : result.deletedRecordIds.length;
      const skippedPathCount = result.skippedPaths.length;
      setActionFeedbackMessage(
        isBucketOnlyIssue
          ? `Deleted ${deletedPathCount.toLocaleString()} bucket-only path${deletedPathCount === 1 ? '' : 's'} in one Syfon bulk request.${skippedPathCount > 0 ? ` ${skippedPathCount.toLocaleString()} selected path${skippedPathCount === 1 ? '' : 's'} disappeared before deletion.` : ''}`
          : `Deleted ${deletedPathCount.toLocaleString()} Bucket + Syfon, No Git path${deletedPathCount === 1 ? '' : 's'} in one Syfon bulk request.${skippedPathCount > 0 ? ` ${skippedPathCount.toLocaleString()} selected path${skippedPathCount === 1 ? '' : 's'} disappeared before deletion.` : ''}`,
      );
      removeHealedChainFindings(
        targetIssue.id,
        targetPaths,
        result.deletedRecordIds.length,
      );
      const refreshed = await runChainAudit({
        bucketInventoryMode: 'validate',
        forceAuditRefresh: true,
      });
      applyStorageChainAuditSummary(refreshed);
      refresh();
    },
    [
      applyCleanup,
      applyStorageChainAuditSummary,
      chainIssueSummaries,
      getChainFindingsForIssue,
      removeHealedChainFindings,
      refresh,
      runChainAudit,
      selectedChainPathsByIssue,
    ],
  );

  const handleRegisterSelectedGitOnly = useCallback(async () => {
    const targetPaths = selectedChainPathsByIssue.git_only_no_syfon ?? [];
    const gitRevision = chainAuditResult?.summary.gitRevision;
    if (targetPaths.length === 0 || !gitRevision) {
      return;
    }
    const approved = window.confirm(
      `Create ${targetPaths.length.toLocaleString()} Syfon record${targetPaths.length === 1 ? '' : 's'}?\n\nGecko will re-read each Git LFS pointer and live-check the mapped bucket object. It will create only records whose bucket object is present and has the same byte size; every other selected path will return a precise skipped reason. RGW does not expose a SHA-256 here, so this action cannot prove the bucket bytes match the Git checksum.`,
    );
    if (!approved) {
      return;
    }
    const result = await registerGitOnlySyfonRecords({
      expectedGitRevision: gitRevision,
      repoPaths: targetPaths,
    });
    if (!result) {
      return;
    }
    const createdCount = result.results.filter(
      (item) => item.status === 'created',
    ).length;
    const skippedCount = result.results.length - createdCount;
    setActionFeedbackMessage(
      `Created ${createdCount.toLocaleString()} Syfon record${createdCount === 1 ? '' : 's'}${skippedCount > 0 ? `; ${skippedCount.toLocaleString()} path${skippedCount === 1 ? '' : 's'} skipped after live revalidation.` : '.'}`,
    );
    setSelectedChainPathsForIssue('git_only_no_syfon', []);
    const refreshed = await runChainAudit({
      bucketInventoryMode: 'validate',
      forceAuditRefresh: true,
    });
    applyStorageChainAuditSummary(refreshed);
    refresh();
  }, [
    applyStorageChainAuditSummary,
    chainAuditResult?.summary.gitRevision,
    refresh,
    registerGitOnlySyfonRecords,
    runChainAudit,
    selectedChainPathsByIssue.git_only_no_syfon,
    setSelectedChainPathsForIssue,
  ]);

  const pageContent = (
    <div className="min-h-screen bg-[#f6f8fa]">
      <Container
        className="w-full max-w-none"
        fluid
        pb="xl"
        pt={isProjectScopedRoute ? 'sm' : 'xl'}
      >
        <Stack gap="lg">
          {!isProjectScopedRoute ||
          (!selectedProject && !isProjectsLoading) ||
          error ? (
            <Stack gap="md" px="sm">
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
                    setCurrentPath(
                      configuration?.defaultPath?.trim() ?? '',
                    );
                  }}
                  placeholder="Select a project"
                  searchable
                  value={selectedProject}
                />
              ) : null}

              {!selectedProject &&
              !isProjectsLoading &&
              !isProjectScopedRoute ? (
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
          ) : null}

          {isProjectsLoading || isLoading ? (
            <Center h="45vh">
              <Loader size={32} />
            </Center>
          ) : selectedProjectParts ? (
            <>
              {storageTab === 'browser' ? (
                <Stack gap="md">
                  <Stack gap="xs" px="sm" pt="xs">
                    <Group
                      className="min-w-0"
                      gap="sm"
                      justify="space-between"
                      wrap="nowrap"
                    >
                      {browserBreadcrumbs}
                    </Group>
                  </Stack>
                  <StorageBrowser
                    data={data}
                    filesummaryConfig={configuration ?? undefined}
                    isLoadingMore={isLoadingMore}
                    largestRowSize={largestRowSize}
                    onLoadMore={() => {
                      void loadMore();
                    }}
                    onPathChange={setCurrentPath}
                    onSort={handleStorageSort}
                    sortedRows={sortedRows}
                    storageSortDirection={storageSortDirection}
                    storageSortKey={storageSortKey}
                  />
                </Stack>
              ) : null}

              {storageTab === 'audit' ? (
                <Stack gap="md">
                  <Stack gap="xs" px="sm" pt="xs">
                    <Group
                      className="min-w-0"
                      gap="sm"
                      justify="space-between"
                      wrap="nowrap"
                    >
                      {browserBreadcrumbs}
                      {auditRefreshUtility}
                    </Group>
                  </Stack>
                  <StorageChainAuditReport
                    actionFeedbackMessage={actionFeedbackMessage}
                    onDismissActionFeedback={() =>
                      setActionFeedbackMessage(null)
                    }
                    applyError={applyError}
                    onDismissApplyError={clearApplyError}
                    onDismissApplyResult={() => {
                      clearApplyResult();
                      setActionFeedbackMessage(null);
                    }}
                    applyResult={applyResult}
                    auditError={chainAuditError}
                    auditResult={chainAuditResult}
                    chainIssueSummaries={chainIssueSummaries}
                    chainIssueFindingsByKind={chainIssueFindingsByKind}
                    cleanChainJoinCount={cleanChainJoinCount}
                    expandedChainTreeNodes={expandedChainTreeNodes}
                    expandedIssueIds={expandedChainIssueIds}
                    expandedIssueLoadErrors={chainIssueLoadErrors}
                    expandedIssueLoadNotices={chainIssueLoadNotices}
                    isApplying={isApplying}
                    isAuditing={isAuditing}
                    isChainAuditing={isChainAuditing}
                    gitOnlyRegistrationError={gitOnlyRegistrationError}
                    isRegisteringGitOnly={isRegisteringGitOnly}
                    loadingChainIssueId={loadingChainIssueId}
                    onRunIssueAction={(args) => {
                      void runIssueAction(args);
                    }}
                    onSelectedChainPathsChange={setSelectedChainPathsForIssue}
                    onToggleChainIssueDetails={handleToggleChainIssueDetails}
                    onApplySelectedChainObjects={(issueId) => {
                      void handleApplySelectedChainObjects(issueId);
                    }}
                    onRegisterSelectedGitOnly={() => {
                      void handleRegisterSelectedGitOnly();
                    }}
                    selectedChainPathsByIssue={selectedChainPathsByIssue}
                    setExpandedChainTreeNodes={setExpandedChainTreeNodes}
                    setTreeNodeLimit={setTreeNodeLimit}
                    treeNodeLimit={treeNodeLimit}
                  />
                </Stack>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Container>
    </div>
  );

  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems }}
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
            hasExplorerConfig={hasExplorerConfig}
            organization={routeOrganization}
            project={routeProject}
            toolbarContent={storageTabToolbar}
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
