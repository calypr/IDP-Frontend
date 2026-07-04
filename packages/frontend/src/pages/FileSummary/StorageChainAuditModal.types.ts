import type React from 'react';
import type {
  AuditActionOption,
  ProjectDiffAuditResult,
  ProjectDiffFinding,
  StorageChainAuditResult,
  StorageChainFinding,
  StorageCleanupApplyResult,
  StorageCleanupAuditResult,
} from './storageTypes';
import type {
  ChainIssueSummary,
  CleanupIssueSummary,
  ProjectDiffIssueSummary,
} from './storageIssueSummaries';
import type {
  ActionIssueSource,
  ActionableFinding,
  ChainPathTreeNode,
} from './storagePresentation';

export type RunIssueActionArgs = {
  defaultAction?: AuditActionOption;
  findings: Array<ActionableFinding>;
  issueId: string;
  issueTitle: string;
  paths: Array<string>;
  source: ActionIssueSource;
};

export type StorageChainAuditModalProps = {
  readonly actionFeedbackMessage: string | null;
  readonly actionableChainSelectionIssue: boolean;
  readonly applyError: string | null;
  readonly applyResult: StorageCleanupApplyResult | null;
  readonly auditError: string | null;
  readonly auditResult: StorageCleanupAuditResult | null;
  readonly chainAuditError: string | null;
  readonly chainAuditResult: StorageChainAuditResult | null;
  readonly chainIssueSummaries: Array<ChainIssueSummary>;
  readonly chainPathTree: Array<ChainPathTreeNode>;
  readonly cleanChainJoinCount: number;
  readonly cleanupIssueSummaries: Array<CleanupIssueSummary>;
  readonly diffAuditResult: ProjectDiffAuditResult | null;
  readonly diffIssueSummaries: Array<ProjectDiffIssueSummary>;
  readonly expandedChainTreeNodes: Record<string, boolean>;
  readonly hasChainIssues: boolean;
  readonly hasCleanupFindings: boolean;
  readonly hasSafeDuplicateCleanup: boolean;
  readonly isApplying: boolean;
  readonly isAuditing: boolean;
  readonly isBulkDeletingRecords: boolean;
  readonly isChainAuditing: boolean;
  readonly isDuplicateVerificationContext: boolean;
  readonly opened: boolean;
  readonly pathsByParent: Map<string, Array<ChainPathTreeNode>>;
  readonly selectableChainPaths: Array<string>;
  readonly selectedChainFindings: Array<StorageChainFinding>;
  readonly selectedChainIssue: ChainIssueSummary | null;
  readonly selectedChainPaths: Array<string>;
  readonly selectedChainPathsSet: Set<string>;
  readonly selectedDiffFindings: Array<ProjectDiffFinding>;
  readonly selectedDiffIssue: ProjectDiffIssueSummary | null;
  readonly showCleanupDetails: boolean;
  readonly showDiffDetails: boolean;
  readonly treeNodeLimit: Record<string, number>;
  readonly onApplySelectedChainObjects: () => void;
  readonly onClose: () => void;
  readonly onRunIssueAction: (args: RunIssueActionArgs) => void;
  readonly onSelectedChainPathsChange: (paths: Array<string>) => void;
  readonly onSelectedDiffIssueChange: (issueId: string | null) => void;
  readonly onToggleAllChainPaths: (checked: boolean) => void;
  readonly onToggleChainIssueDetails: (issueId: string) => void;
  readonly onToggleChainPath: (path: string, checked: boolean) => void;
  readonly setExpandedChainTreeNodes: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  readonly setTreeNodeLimit: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
};
