import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import GitProjectFilePage from './GitProjectFile';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@gen3/core', () => ({
  SYFON_API: '/syfon',
  mintSyfonObjectIdFromChecksum: jest.fn(),
  useGetGeckoGitProjectFileQuery: jest.fn(),
  useGetGeckoGitProjectsQuery: jest.fn(),
  useGetGeckoGitProjectRefsQuery: jest.fn(),
}));

jest.mock('../../features/Navigation', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/Protected/ProtectedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../utils', () => ({
  useIsEmbedded: jest.fn(() => false),
}));

const { useRouter } = jest.requireMock('next/router') as {
  useRouter: jest.Mock;
};

const coreMocks = jest.requireMock('@gen3/core') as {
  mintSyfonObjectIdFromChecksum: jest.Mock;
  useGetGeckoGitProjectFileQuery: jest.Mock;
  useGetGeckoGitProjectsQuery: jest.Mock;
  useGetGeckoGitProjectRefsQuery: jest.Mock;
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

describe('GitProjectFilePage', () => {
  const originalFetch = global.fetch;
  const originalWindowOpen = window.open;

  beforeEach(() => {
    useRouter.mockReturnValue({
      query: {
        org: 'Ellrott_Lab',
        project: 'embedding_rotation',
        path: ['data', 'compiled.fasta'],
      },
      push: jest.fn(),
    });
    coreMocks.useGetGeckoGitProjectsQuery.mockReturnValue({
      data: [
        {
          organization: 'Ellrott_Lab',
          project: 'embedding_rotation',
          installation_state: 'connected',
          default_branch: 'main',
        },
      ],
      isLoading: false,
    });
    coreMocks.useGetGeckoGitProjectRefsQuery.mockReturnValue({
      data: {
        default_branch: 'main',
        refs: [{ name: 'main', type: 'branch', hash: 'abc123', default: true }],
      },
      isLoading: false,
    });
    coreMocks.mintSyfonObjectIdFromChecksum.mockResolvedValue('did-123');
    window.open = jest.fn();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    window.open = originalWindowOpen;
    jest.clearAllMocks();
  });

  it('routes detected Git LFS pointer files to Syfon instead of GitHub', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        'version https://git-lfs.github.com/spec/v1\noid sha256:670ed063c6a4d6df5530c50ee2e23399046df20bf48b5b5aebfbbe1c865c0642\nsize 5942160\n',
    }) as jest.Mock;
    coreMocks.useGetGeckoGitProjectFileQuery.mockReturnValue({
      data: {
        project_id: 'Ellrott_Lab/embedding_rotation',
        ref: 'main',
        path: 'data/compiled.fasta',
        name: 'compiled.fasta',
        hash: 'abc123',
        size: 132,
        html_url: 'https://github.com/EllrottLab/embedding-rotation/blob/main/data/compiled.fasta',
        download_url:
          'https://raw.githubusercontent.com/EllrottLab/embedding-rotation/main/data/compiled.fasta',
      },
      isLoading: false,
    });

    const { container } = render(
      <MantineProvider>
        <GitProjectFilePage {...layoutProps} />
      </MantineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/git lfs pointer detected/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('link', { name: /open on github/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/version https:\/\/git-lfs\.github\.com\/spec\/v1/i),
    ).not.toBeInTheDocument();

    const downloadButton = screen.getByRole('button', {
      name: /download file/i,
    });
    await waitFor(() => expect(downloadButton).not.toBeDisabled());

    fireEvent.click(downloadButton);

    await waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        '/syfon/download/did-123?redirect=true',
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });

  it('still shows GitHub actions for ordinary tracked files', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'alpha\tbeta\n1\t2\n',
    }) as jest.Mock;
    coreMocks.useGetGeckoGitProjectFileQuery.mockReturnValue({
      data: {
        project_id: 'Ellrott_Lab/embedding_rotation',
        ref: 'main',
        path: 'data/table.tsv',
        name: 'table.tsv',
        hash: 'abc123',
        size: 16,
        html_url: 'https://github.com/EllrottLab/embedding-rotation/blob/main/data/table.tsv',
        download_url:
          'https://raw.githubusercontent.com/EllrottLab/embedding-rotation/main/data/table.tsv',
      },
      isLoading: false,
    });

    const { container } = render(
      <MantineProvider>
        <GitProjectFilePage {...layoutProps} />
      </MantineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /open on github/i })).toBeInTheDocument(),
    );
    expect(
      screen.queryByText(/git lfs pointer detected/i),
    ).not.toBeInTheDocument();
    expect(container.querySelector('pre')?.textContent).toContain(
      'alpha\tbeta\n1\t2\n',
    );
  });
});
