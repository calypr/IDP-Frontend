import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CALYPR_EXPLORER_CONFIG_API } from '@gen3/core';
import {
  Alert,
  Center,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout, ProjectWorkspaceTabs } from '../../features/Navigation';
import { FileSummaryPageProps } from './types';
import {
  type AuditActionOption,
  type StorageApplyActionRequest,
  type StorageChainFinding,
  type StorageCleanupFinding,
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
import { StorageChainAuditReport } from './StorageChainAuditReport';
import { summarizeStorageChainIssues } from './storageIssueSummaries';
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
  const [showChainAuditReport, setShowChainAuditReport] = useState(false);
  const [chainIssueFindingsByKind, setChainIssueFindingsByKind] = useState<
    Record<string, Array<StorageChainFinding>>
  >({});
  const [chainIssueLoadErrors, setChainIssueLoadErrors] = useState<
    Record<string, string>
  >({});
  const [loadingChainIssueId, setLoadingChainIssueId] = useState<string | null>(
    null,
  );
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
    applyCleanup,
    applyError,
    applyResult,
    clearCleanupResults,
    isApplying,
    isAuditing,
  } = useSyfonStorageCleanup({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  useEffect(() => {
    clearChainAudit();
    clearCleanupResults();
  }, [clearChainAudit, clearCleanupResults, currentPath, selectedProject]);

  useEffect(() => {
    setActionFeedbackMessage(null);
    setSelectedChainIssueId(null);
    setSelectedChainPathsByIssue({});
    setExpandedChainTreeNodes({});
    setTreeNodeLimit({});
    setShowChainAuditReport(false);
    setChainIssueFindingsByKind({});
    setChainIssueLoadErrors({});
    setLoadingChainIssueId(null);
  }, [currentPath, selectedProject]);

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
  const selectedChainIssue = useMemo(
    () =>
      chainIssueSummaries.find((issue) => issue.id === selectedChainIssueId) ??
      null,
    [chainIssueSummaries, selectedChainIssueId],
  );
  const selectedChainFindings = useMemo(() => {
    if (!selectedChainIssue) {
      return [];
    }
    const fullIssueFindings = chainIssueFindingsByKind[selectedChainIssue.id];
    if (fullIssueFindings) {
      return fullIssueFindings;
    }
    return (chainAuditResult?.findings ?? []).filter(
      (finding) => finding.kind === selectedChainIssue.id,
    );
  }, [
    chainAuditResult?.findings,
    chainIssueFindingsByKind,
    selectedChainIssue,
  ]);
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
      setSelectedChainIssueId((current) =>
        current === issueId ? null : current,
      );
    },
    [setChainAuditResult],
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
        setSelectedChainIssueId(issueId);
        return;
      }

      if (actionName === 'rerun_audit') {
        await runChainAudit();
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
      removeHealedChainFindings,
      refresh,
      resolveIssueAction,
      runChainAudit,
    ],
  );

  const loadChainIssueDetails = useCallback(
    async (issueId: string) => {
      if (chainIssueFindingsByKind[issueId]) {
        return;
      }

      setLoadingChainIssueId(issueId);
      setChainIssueLoadErrors((current) => {
        const next = { ...current };
        delete next[issueId];
        return next;
      });

      try {
        const result = await runChainAudit({
          findingKind: issueId,
          findingLimit: -1,
          persistResult: false,
        });
        if (!result) {
          setChainIssueLoadErrors((current) => ({
            ...current,
            [issueId]: 'Failed to load issue details.',
          }));
          return;
        }
        setChainIssueFindingsByKind((current) => ({
          ...current,
          [issueId]: result.findings.filter(
            (finding) => finding.kind === issueId,
          ),
        }));
      } catch (error) {
        setChainIssueLoadErrors((current) => ({
          ...current,
          [issueId]:
            error instanceof Error
              ? error.message
              : 'Failed to load issue details.',
        }));
      } finally {
        setLoadingChainIssueId((current) =>
          current === issueId ? null : current,
        );
      }
    },
    [chainIssueFindingsByKind, runChainAudit],
  );

  const handleToggleChainIssueDetails = useCallback(
    (issueId: string) => {
      setSelectedChainIssueId((current) => {
        if (current === issueId) {
          return null;
        }
        void loadChainIssueDetails(issueId);
        return issueId;
      });
    },
    [loadChainIssueDetails],
  );

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
              <StorageBrowser
                auditReport={
                  <StorageChainAuditReport
                    actionFeedbackMessage={actionFeedbackMessage}
                    applyError={applyError}
                    applyResult={applyResult}
                    auditError={chainAuditError}
                    auditResult={chainAuditResult}
                    chainIssueSummaries={chainIssueSummaries}
                    cleanChainJoinCount={cleanChainJoinCount}
                    expandedChainTreeNodes={expandedChainTreeNodes}
                    expandedIssueFindings={selectedChainFindings}
                    expandedIssueId={selectedChainIssueId}
                    expandedIssueLoadError={
                      selectedChainIssueId
                        ? chainIssueLoadErrors[selectedChainIssueId]
                        : undefined
                    }
                    expandedIssueLoading={
                      loadingChainIssueId === selectedChainIssueId
                    }
                    isApplying={isApplying}
                    isAuditing={isAuditing}
                    isChainAuditing={isChainAuditing}
                    isOpen={showChainAuditReport}
                    onApplySelectedChainObjects={() => {
                      void handleApplySelectedChainObjects();
                    }}
                    onOpenChange={setShowChainAuditReport}
                    onRunIssueAction={(args) => {
                      void runIssueAction(args);
                    }}
                    onSelectedChainPathsChange={setSelectedChainPathsForIssue}
                    onToggleAllChainPaths={handleToggleAllChainPaths}
                    onToggleChainIssueDetails={handleToggleChainIssueDetails}
                    onToggleChainPath={handleToggleChainPath}
                    selectedChainPaths={selectedChainPaths}
                    selectedChainPathsSet={selectedChainPathsSet}
                    setExpandedChainTreeNodes={setExpandedChainTreeNodes}
                    setTreeNodeLimit={setTreeNodeLimit}
                    treeNodeLimit={treeNodeLimit}
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
