import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import GitProjectPage from './GitProject';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@gen3/core', () => ({
  SYFON_API: '/syfon',
  useGetGeckoGitProjectsQuery: jest.fn(),
  useGetGeckoGitProjectRefsQuery: jest.fn(),
  useGetGeckoGitProjectStatusQuery: jest.fn(),
  useGetGeckoGitProjectTreeQuery: jest.fn(),
  useLazyGetGeckoGitProjectFileQuery: jest.fn(),
  useGetSyfonObjectsByChecksumQuery: jest.fn(),
  useLazyGetSyfonObjectsByChecksumQuery: jest.fn(),
  useReconcileGeckoGitOrganizationMutation: jest.fn(),
  useRefreshGeckoGitProjectMutation: jest.fn(),
}));

jest.mock('../../features/Navigation', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/Protected/ProtectedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./GitUploadPRModal', () => ({
  __esModule: true,
  default: ({
    onClose,
    onSuccess,
    opened,
  }: {
    onClose: () => void;
    onSuccess: (result: { branchName: string; pullRequestURL: string }) => void;
    opened: boolean;
  }) =>
    opened ? (
      <div>
        <button
          onClick={() =>
            onSuccess({
              branchName: 'calypr/upload-test-branch',
              pullRequestURL: 'https://github.com/example/repo/pull/123',
            })
          }
        >
          Complete upload flow
        </button>
        <button onClick={onClose}>Close upload flow</button>
      </div>
    ) : null,
}));

const { useRouter } = jest.requireMock('next/router') as {
  useRouter: jest.Mock;
};

const coreMocks = jest.requireMock('@gen3/core') as {
  useGetGeckoGitProjectsQuery: jest.Mock;
  useGetGeckoGitProjectRefsQuery: jest.Mock;
  useGetGeckoGitProjectStatusQuery: jest.Mock;
  useGetGeckoGitProjectTreeQuery: jest.Mock;
  useLazyGetGeckoGitProjectFileQuery: jest.Mock;
  useGetSyfonObjectsByChecksumQuery: jest.Mock;
  useLazyGetSyfonObjectsByChecksumQuery: jest.Mock;
  useReconcileGeckoGitOrganizationMutation: jest.Mock;
  useRefreshGeckoGitProjectMutation: jest.Mock;
};

const layoutProps = {
  footerProps: {
    basePage: false,
    rightSection: {
      columns: [],
      basePage: false,
    },
  },
  headerProps: {
    banners: [],
    basePage: false,
    leftnav: [],
    navigation: { items: [] },
    topBar: {
      items: [],
      loginButtonVisibility: undefined,
      onToggle: jest.fn(),
    },
  },
  headerMetadata: {
    content: 'test',
    key: 'test',
    title: 'test',
  },
};

describe('GitProjectPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useRouter.mockReturnValue({
      query: {
        org: 'Ellrott_Lab',
        project: 'embedding_rotation',
      },
    });
    coreMocks.useRefreshGeckoGitProjectMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
    coreMocks.useGetGeckoGitProjectsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useReconcileGeckoGitOrganizationMutation.mockReturnValue([
      jest.fn(() => ({ unwrap: jest.fn().mockResolvedValue(undefined) })),
      { isLoading: false },
    ]);
    coreMocks.useGetGeckoGitProjectRefsQuery.mockReturnValue({
      data: { default_branch: 'main', refs: [] },
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectTreeQuery.mockReturnValue({
      data: { entries: [] },
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useLazyGetGeckoGitProjectFileQuery.mockReturnValue([
      jest.fn(() => ({ unwrap: jest.fn().mockResolvedValue({}) })),
      { isLoading: false },
    ]);
    coreMocks.useGetSyfonObjectsByChecksumQuery.mockReturnValue({
      data: undefined,
      isFetching: false,
      isLoading: false,
    });
    coreMocks.useLazyGetSyfonObjectsByChecksumQuery.mockReturnValue([
      jest.fn(() => ({ unwrap: jest.fn().mockResolvedValue({}) })),
    ]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows repo-specific guidance when github is unconnected', () => {
    const projectStatus = {
      project_id: 'Ellrott_Lab/embedding_rotation',
      organization: 'Ellrott_Lab',
      project: 'embedding_rotation',
      resource_path: '/programs/Ellrott_Lab/projects/embedding_rotation',
      config: {
        title: 'Embedding Rotation',
        contact_email: 'owner@example.org',
        src_repo: 'github.com/EllrottLab/embedding-rotation',
        org_title: 'Ellrott Lab',
        description: 'Test project',
        project_title: 'Embedding Rotation',
        icon_name: 'git.png',
      },
      repository: {
        host: 'github.com',
        owner: 'EllrottLab',
        repo: 'embedding-rotation',
        url: 'https://github.com/EllrottLab/embedding-rotation',
      },
      workflow_stage: 'awaiting_github_connect',
      installation_state: 'not_connected',
      organization_app_installed: true,
      sync_state: 'never_synced',
      mirror_ready: false,
    };
    coreMocks.useGetGeckoGitProjectStatusQuery.mockReturnValue({
      data: projectStatus,
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectsQuery.mockReturnValue({
      data: [projectStatus],
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(
      screen.getByText(
        /github is not connected for this project yet\. update repository access from/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('renders repository tree controls for a connected project', () => {
    const projectStatus = {
      project_id: 'Ellrott_Lab/embedding_rotation',
      organization: 'Ellrott_Lab',
      project: 'embedding_rotation',
      resource_path: '/programs/Ellrott_Lab/projects/embedding_rotation',
      config: {
        title: 'Embedding Rotation',
        contact_email: 'owner@example.org',
        src_repo: 'github.com/EllrottLab/embedding-rotation',
        org_title: 'Ellrott Lab',
        description: 'Test project',
        project_title: 'Embedding Rotation',
        icon_name: 'git.png',
      },
      repository: {
        host: 'github.com',
        owner: 'EllrottLab',
        repo: 'embedding-rotation',
        url: 'https://github.com/EllrottLab/embedding-rotation',
      },
      installation_state: 'connected',
      installation_target: 'EllrottLab',
      installation_target_type: 'Organization',
      organization_app_installed: true,
      sync_state: 'ready',
      default_branch: 'main',
      mirror_ready: true,
    };
    coreMocks.useGetGeckoGitProjectStatusQuery.mockReturnValue({
      data: projectStatus,
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectsQuery.mockReturnValue({
      data: [projectStatus],
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectRefsQuery.mockReturnValue({
      data: {
        default_branch: 'main',
        refs: [{ name: 'main', type: 'branch', hash: 'abc123', default: true }],
      },
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectTreeQuery.mockReturnValue({
      data: {
        entries: [
          {
            name: 'README.md',
            path: 'README.md',
            type: 'blob',
            hash: 'abc123def456',
            size: 42,
          },
        ],
      },
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(
      screen.getByRole('button', { name: /refresh repository/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /upload files/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /remote add/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByDisplayValue('main')).toBeInTheDocument();
  });

  it('shows mirror initialization guidance when the repository is connected but not ready', () => {
    const refetchStatus = jest.fn();
    const projectStatus = {
      project_id: 'Ellrott_Lab/embedding_rotation',
      organization: 'Ellrott_Lab',
      project: 'embedding_rotation',
      resource_path: '/programs/Ellrott_Lab/projects/embedding_rotation',
      config: {
        title: 'Embedding Rotation',
        contact_email: 'owner@example.org',
        src_repo: 'github.com/EllrottLab/embedding-rotation',
        org_title: 'Ellrott Lab',
        description: 'Test project',
        project_title: 'Embedding Rotation',
        icon_name: 'git.png',
      },
      repository: {
        host: 'github.com',
        owner: 'EllrottLab',
        repo: 'embedding-rotation',
        url: 'https://github.com/EllrottLab/embedding-rotation',
      },
      installation_state: 'connected',
      installation_target: 'EllrottLab',
      installation_target_type: 'Organization',
      organization_app_installed: true,
      sync_state: 'updating',
      default_branch: 'main',
      mirror_ready: false,
    };
    coreMocks.useGetGeckoGitProjectStatusQuery.mockReturnValue({
      data: projectStatus,
      isLoading: false,
      refetch: refetchStatus,
    });
    coreMocks.useGetGeckoGitProjectsQuery.mockReturnValue({
      data: [projectStatus],
      isLoading: false,
      refetch: refetchStatus,
    });
    coreMocks.useGetGeckoGitProjectRefsQuery.mockReturnValue({
      data: { default_branch: 'main', refs: [] },
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectTreeQuery.mockReturnValue({
      data: { entries: [] },
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(
      screen.getByText(/initializing repository mirror/i),
    ).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(refetchStatus).toHaveBeenCalled();
  });

  it('closes the upload modal and shows a persistent success banner after PR creation', () => {
    const projectStatus = {
      project_id: 'Ellrott_Lab/embedding_rotation',
      organization: 'Ellrott_Lab',
      project: 'embedding_rotation',
      resource_path: '/programs/Ellrott_Lab/projects/embedding_rotation',
      config: {
        title: 'Embedding Rotation',
        contact_email: 'owner@example.org',
        src_repo: 'github.com/EllrottLab/embedding-rotation',
        org_title: 'Ellrott Lab',
        description: 'Test project',
        project_title: 'Embedding Rotation',
        icon_name: 'git.png',
      },
      repository: {
        host: 'github.com',
        owner: 'EllrottLab',
        repo: 'embedding-rotation',
        url: 'https://github.com/EllrottLab/embedding-rotation',
      },
      installation_state: 'connected',
      installation_target: 'EllrottLab',
      installation_target_type: 'Organization',
      organization_app_installed: true,
      sync_state: 'ready',
      default_branch: 'main',
      mirror_ready: true,
    };
    coreMocks.useGetGeckoGitProjectStatusQuery.mockReturnValue({
      data: projectStatus,
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectsQuery.mockReturnValue({
      data: [projectStatus],
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectRefsQuery.mockReturnValue({
      data: {
        default_branch: 'main',
        refs: [{ name: 'main', type: 'branch', hash: 'abc123', default: true }],
      },
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectTreeQuery.mockReturnValue({
      data: {
        entries: [],
      },
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /upload files/i }));
    expect(screen.getByRole('button', { name: /complete upload flow/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /complete upload flow/i }));

    expect(
      screen.queryByRole('button', { name: /complete upload flow/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/pull request created on branch/i),
    ).toBeInTheDocument();
    expect(screen.getByText('calypr/upload-test-branch')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open pull request/i })).toHaveAttribute(
      'href',
      'https://github.com/example/repo/pull/123',
    );
  });

  it('shows lfs download actions when the selected file is a git lfs pointer', () => {
    const projectStatus = {
      project_id: 'Ellrott_Lab/embedding_rotation',
      organization: 'Ellrott_Lab',
      project: 'embedding_rotation',
      resource_path: '/programs/Ellrott_Lab/projects/embedding_rotation',
      config: {
        title: 'Embedding Rotation',
        contact_email: 'owner@example.org',
        src_repo: 'github.com/EllrottLab/embedding-rotation',
        org_title: 'Ellrott Lab',
        description: 'Test project',
        project_title: 'Embedding Rotation',
        icon_name: 'git.png',
      },
      repository: {
        host: 'github.com',
        owner: 'EllrottLab',
        repo: 'embedding-rotation',
        url: 'https://github.com/EllrottLab/embedding-rotation',
      },
      installation_state: 'connected',
      installation_target: 'EllrottLab',
      installation_target_type: 'Organization',
      organization_app_installed: true,
      sync_state: 'ready',
      default_branch: 'main',
      mirror_ready: true,
    };
    coreMocks.useGetGeckoGitProjectStatusQuery.mockReturnValue({
      data: projectStatus,
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectsQuery.mockReturnValue({
      data: [projectStatus],
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectRefsQuery.mockReturnValue({
      data: {
        default_branch: 'main',
        refs: [{ name: 'main', type: 'branch', hash: 'abc123', default: true }],
      },
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectTreeQuery.mockReturnValue({
      data: {
        entries: [
          {
            name: 'tcga.tumor.ensembl.tsv',
            path: 'data/tcga.tumor.ensembl.tsv',
            type: 'blob',
            hash: 'abc123def456',
            size: 136,
            lfs_pointer: {
              version: 'https://git-lfs.github.com/spec/v1',
              oid: '0bfab2917ce05007ff6297c0ec93ef575209210e4ca998dbd243a270e2f9ca83',
              size: 3780184021,
            },
          },
        ],
      },
      isLoading: false,
      refetch: jest.fn(),
    });
    coreMocks.useGetSyfonObjectsByChecksumQuery.mockReturnValue({
      data: {
        resolved_drs_object: [{ id: 'did-123' }],
      },
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <GitProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getAllByText('LFS').length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText(/download lfs object for data\/tcga\.tumor\.ensembl\.tsv/i),
    ).toBeInTheDocument();
  });
});
