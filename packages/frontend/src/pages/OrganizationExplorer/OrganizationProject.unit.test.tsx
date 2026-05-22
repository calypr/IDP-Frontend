import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import OrganizationProjectPage from './OrganizationProject';

const pushMock = jest.fn();
const openMock = jest.fn();
const scrollToMock = jest.fn();
const requestAnimationFrameMock = jest.fn((callback: FrameRequestCallback) => {
  callback(0);
  return 0;
});
const writeTextMock = jest.fn().mockResolvedValue(undefined);
const useGetSyfonIndexRecordsQueryMock = jest.fn();
const routerQuery = {
  org: 'org-a',
  project: 'proj-a',
} as Record<string, string>;

jest.mock('@gen3/core', () => ({
  SYFON_API: '/data',
  normalizeSyfonResourcePath: (resourcePath: string) =>
    resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`,
  useGetSyfonIndexRecordsQuery: (...args: unknown[]) =>
    useGetSyfonIndexRecordsQueryMock(...args),
}));

jest.mock('../../features/Navigation', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: pushMock,
    query: routerQuery,
  }),
}));

jest.mock('../../components/Protected/ProtectedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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

describe('OrganizationProjectPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    openMock.mockReset();
    scrollToMock.mockReset();
    requestAnimationFrameMock.mockClear();
    writeTextMock.mockClear();
    useGetSyfonIndexRecordsQueryMock.mockReset();
    window.open = openMock;
    window.scrollTo = scrollToMock;
    window.requestAnimationFrame = requestAnimationFrameMock;
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
    routerQuery.org = 'org-a';
    routerQuery.project = 'proj-a';
    delete routerQuery.path;
  });

  it('requests Syfon records for the current org/project and renders repo entries', () => {
    useGetSyfonIndexRecordsQueryMock.mockReturnValue({
      data: [
        {
          controlled_access: ['/organization/org-a/project/proj-a'],
          did: 'did-1',
          file_name: 'nested/file-a.txt',
          size: 10,
        },
        {
          controlled_access: ['/organization/org-a/project/proj-a'],
          description: 'root file',
          did: 'did-2',
          file_name: 'root.txt',
          name: 'Root Display Name',
          size: 20,
        },
      ],
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(useGetSyfonIndexRecordsQueryMock).toHaveBeenCalledWith(
      {
        limit: 1000,
        organization: 'org-a',
        project: 'proj-a',
      },
      { skip: false },
    );

    expect(screen.queryByText(/git drs remote add gen3 production org-a\/proj-a/i)).not.toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
    expect(screen.getByText('Root Display Name')).toBeInTheDocument();

    fireEvent.click(screen.getByText('nested'));
    expect(pushMock).toHaveBeenCalled();
  });

  it('does not show git-specific remote add controls in syfon view', () => {
    useGetSyfonIndexRecordsQueryMock.mockReturnValue({
      data: [],
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(
      screen.queryByRole('button', { name: /remote add/i }),
    ).not.toBeInTheDocument();
  });

  it('copies the current repository path and searches files in memory', async () => {
    useGetSyfonIndexRecordsQueryMock.mockReturnValue({
      data: [
        {
          controlled_access: ['/organization/org-a/project/proj-a'],
          did: 'did-go-mod',
          file_name: 'nested/go.mod',
          name: 'go.mod',
          size: 10,
        },
        {
          controlled_access: ['/organization/org-a/project/proj-a'],
          did: 'did-readme',
          file_name: 'README.md',
          name: 'README.md',
          size: 20,
        },
      ],
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy repository path'));
    });

    expect(writeTextMock).toHaveBeenCalledWith('org-a/proj-a');

    fireEvent.change(screen.getByPlaceholderText('Go to file'), {
      target: { value: 'go.mod' },
    });

    expect(screen.getByText('nested/go.mod')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('nested/go.mod'));
    });

    expect(pushMock).toHaveBeenCalledWith(
      {
        pathname: '/organization/[org]/project/[project]',
        query: {
          file: 'did-go-mod',
          org: 'org-a',
          path: 'nested',
          project: 'proj-a',
        },
      },
      undefined,
      { shallow: true },
    );
  });

  it('shows file metadata when a file is selected', () => {
    useGetSyfonIndexRecordsQueryMock.mockReturnValue({
      data: [
        {
          access_methods: [
            {
              access_url: { url: 'https://example.org/root.txt' },
              type: 's3',
            },
          ],
          controlled_access: ['/organization/org-a/project/proj-a'],
          did: 'did-2',
          file_name: 'root.txt',
          hashes: { sha256: 'abc' },
          name: 'Root Display Name',
          size: 20,
        },
      ],
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 480,
      writable: true,
    });

    fireEvent.click(screen.getByText('Root Display Name'));

    expect(screen.getByText('File Details')).toBeInTheDocument();
    expect(screen.getByText('did-2')).toBeInTheDocument();
    expect(screen.getByText(/sha256:/i)).toBeInTheDocument();
    expect(screen.getByText('Back to files')).toBeInTheDocument();
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.getByText('Repository Path')).toBeInTheDocument();
    expect(scrollToMock).toHaveBeenCalledWith({ behavior: 'auto', top: 0 });

    fireEvent.click(screen.getByText('Back to files'));
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(scrollToMock).toHaveBeenLastCalledWith({
      behavior: 'auto',
      top: 480,
    });
  });

  it('hides the repo path when the Syfon name already matches the derived file name', () => {
    useGetSyfonIndexRecordsQueryMock.mockReturnValue({
      data: [
        {
          controlled_access: ['/organization/org-a/project/proj-a'],
          did: 'did-3',
          file_name: 'exact-match.txt',
          name: 'exact-match.txt',
          size: 10,
        },
      ],
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText('exact-match.txt'));

    expect(screen.queryByText('Repository Path')).not.toBeInTheDocument();
  });

  it('downloads from the far-right table action without opening details', () => {
    useGetSyfonIndexRecordsQueryMock.mockReturnValue({
      data: [
        {
          controlled_access: ['/organization/org-a/project/proj-a'],
          did: 'did-4',
          file_name: 'downloadable.txt',
          name: 'downloadable.txt',
          size: 10,
        },
      ],
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByLabelText('Download downloadable.txt'));

    expect(openMock).toHaveBeenCalledWith(
      '/data/download/did-4?redirect=true',
      '_blank',
      'noopener,noreferrer',
    );
    expect(screen.queryByText('File Details')).not.toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation for the current path and opens the scoped upload modal', async () => {
    routerQuery.path = 'nested/leaf';
    useGetSyfonIndexRecordsQueryMock.mockReturnValue({
      data: [],
      isFetching: false,
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationProjectPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'proj-a' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'nested' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'leaf' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'nested' }));
    expect(pushMock).toHaveBeenCalledWith(
      {
        pathname: '/organization/[org]/project/[project]',
        query: {
          org: 'org-a',
          project: 'proj-a',
          path: 'nested',
        },
      },
      undefined,
      { shallow: true },
    );

    expect(
      screen.queryByRole('button', { name: 'Upload files' }),
    ).not.toBeInTheDocument();
  });
});
