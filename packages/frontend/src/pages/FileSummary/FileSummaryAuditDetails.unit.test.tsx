import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { FileSummaryPageProps } from './types';
import type {
  StorageChainAuditResult,
  StorageChainFinding,
} from './storageTypes';
import FileSummaryPage from './FileSummary';

type AuditReportHarnessProps = {
  auditError: string | null;
  auditResult: StorageChainAuditResult | null;
  chainIssueFindingsByKind: Record<string, Array<StorageChainFinding>>;
  expandedIssueIds: Set<string>;
  onSelectedChainPathsChange: (issueId: string, paths: Array<string>) => void;
  onToggleChainIssueDetails: (issueId: string) => void;
  selectedChainPathsByIssue: Record<string, Array<string>>;
};

jest.mock('@gen3/core', () => ({
  GEN3_API: '/api',
  GEN3_GECKO_API: '/api/gecko',
  selectCSRFToken: jest.fn(),
  useCoreSelector: jest.fn(() => undefined),
  useGetCSRFQuery: jest.fn(),
  useGetExplorerStateV1Query: jest.fn(() => ({ data: {} })),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { org: 'HTAN_INT', project: 'ProjectA' },
  }),
}));

jest.mock('../../lib/session/session', () => ({
  requestSessionVerification: jest.fn(),
}));

jest.mock('../../features/Navigation', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProjectWorkspaceTabs: ({
    children,
    toolbarContent,
  }: {
    children: React.ReactNode;
    toolbarContent: React.ReactNode;
  }) => (
    <>
      {toolbarContent}
      {children}
    </>
  ),
}));

jest.mock('../../components/Protected/ProtectedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./StorageBrowser', () => ({
  StorageBrowser: () => null,
}));

jest.mock('./StorageChainAuditReport', () => ({
  StorageChainAuditReport: (props: AuditReportHarnessProps) => {
    const react = jest.requireActual('react');
    const paths = props.auditResult?.findings
      .filter((finding) => finding.kind === 'bucket_only_object')
      .map((finding) => finding.normalizedPath)
      .join(',');
    const detailPaths = props.expandedIssueIds.has('bucket_only_object')
      ? (props.chainIssueFindingsByKind.bucket_only_object ?? [])
          .map((finding) => finding.normalizedPath)
          .join(',')
      : '';
    return react.createElement(
      react.Fragment,
      null,
      react.createElement('div', { 'data-testid': 'audit-error' }, props.auditError),
      react.createElement('div', { 'data-testid': 'audit-paths' }, paths),
      react.createElement(
        'div',
        { 'data-testid': 'issue-details' },
        detailPaths,
      ),
      react.createElement(
        'div',
        { 'data-testid': 'selected-paths' },
        props.selectedChainPathsByIssue.bucket_only_object?.join(',') ?? '',
      ),
      react.createElement(
        'button',
        {
          onClick: () =>
            props.onToggleChainIssueDetails('bucket_only_object'),
          type: 'button',
        },
        'Toggle issue details',
      ),
      react.createElement(
        'button',
        {
          onClick: () =>
            props.onSelectedChainPathsChange('bucket_only_object', ['old/path']),
          type: 'button',
        },
        'Select old path',
      ),
    );
  },
}));

jest.mock('./hooks', () => {
  const actual = jest.requireActual('./hooks');
  const applyExactChainSummary = jest.fn();
  const refreshStorageSummary = jest.fn();
  const clearCleanupResults = jest.fn();
  const clearApplyError = jest.fn();
  const clearApplyResult = jest.fn();
  const registerGitOnlySyfonRecords = jest.fn();
  return {
    ...actual,
    useSyfonPathStorageSummary: () => ({
      applyExactChainSummary,
      data: { rows: [] },
      error: null,
      isLoading: false,
      isLoadingMore: false,
      loadMore: jest.fn(),
      refresh: refreshStorageSummary,
    }),
    useSyfonStorageCleanup: () => ({
      applyCleanup: jest.fn(),
      applyError: null,
      applyResult: null,
      clearApplyError,
      clearApplyResult,
      clearCleanupResults,
      isApplying: false,
      isAuditing: false,
    }),
    useRegisterGitOnlySyfonRecords: () => ({
      error: null,
      isRegistering: false,
      register: registerGitOnlySyfonRecords,
    }),
  };
});

const pageProps = {
  headerProps: {
    topBar: { items: [] },
    navigation: {},
    leftnav: [],
    basePage: false,
  },
  footerProps: { basePage: false },
  configuration: null,
} satisfies FileSummaryPageProps;

const jsonAuditResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
});

const auditBody = (auditId: string, path: string) => ({
  audit_id: auditId,
  findings: [
    {
      kind: 'bucket_only_object',
      normalized_path: path,
      object_ids: [`object-${auditId}`],
    },
  ],
  summary: {
    git_revision: `git-${auditId}`,
    syfon_revision: `syfon-${auditId}`,
  },
});

const openDetailsAndSelectOldPath = async (fetchMock: jest.Mock) => {
  render(
    <MantineProvider>
      <FileSummaryPage {...pageProps} />
    </MantineProvider>,
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('tab', { name: /Audit/ }));
  await waitFor(() =>
    expect(screen.getByTestId('audit-paths')).toHaveTextContent('old/path'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Toggle issue details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select old path' }));
  expect(screen.getByTestId('issue-details')).toHaveTextContent('old/path');
  expect(screen.getByTestId('selected-paths')).toHaveTextContent('old/path');
};

describe('FileSummary audit issue details', () => {
  it('clears expanded details and selected paths when a refresh succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonAuditResponse(auditBody('saved', 'old/path')))
      .mockResolvedValueOnce(
        jsonAuditResponse(auditBody('refreshed', 'new/path')),
      );
    global.fetch = fetchMock;

    await openDetailsAndSelectOldPath(fetchMock);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh audit' }));

    await waitFor(() =>
      expect(screen.getByTestId('audit-paths')).toHaveTextContent('new/path'),
    );
    expect(screen.getByTestId('issue-details')).toBeEmptyDOMElement();
    expect(screen.getByTestId('selected-paths')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle issue details' }));
    await waitFor(() =>
      expect(screen.getByTestId('issue-details')).toHaveTextContent('new/path'),
    );
    expect(screen.getByTestId('issue-details')).not.toHaveTextContent('old/path');
  });

  it('preserves the expanded details and selection when a refresh fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonAuditResponse(auditBody('saved', 'old/path')))
      .mockResolvedValueOnce(
        jsonAuditResponse({ message: 'Refresh unavailable' }, 503),
      );
    global.fetch = fetchMock;

    await openDetailsAndSelectOldPath(fetchMock);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh audit' }));

    await waitFor(() =>
      expect(screen.getByTestId('audit-error')).toHaveTextContent(
        'Refresh unavailable',
      ),
    );
    expect(screen.getByTestId('audit-paths')).toHaveTextContent('old/path');
    expect(screen.getByTestId('issue-details')).toHaveTextContent('old/path');
    expect(screen.getByTestId('selected-paths')).toHaveTextContent('old/path');
  });
});
