import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import ProjectExplorerBuilder, {
  getServerSideProps,
} from '../pages/org/[org]/project/[project]/explorers/builder';
import type { GetServerSidePropsContext } from 'next';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)}>{children}</a>
  ),
}));

jest.mock(
  '@/lib/content/pageLoader',
  () => ({
    defineSamplePageLoader: jest.fn(() => jest.fn(async () => ({ props: {} }))),
  }),
  { virtual: true },
);

jest.mock('@gen3/frontend', () => ({
  ExplorerBuilderPage: ({
    explorerId,
    onExplorerChange,
  }: {
    explorerId?: string;
    onExplorerChange?: (explorerId: string) => void;
  }) => (
    <button onClick={() => onExplorerChange?.('second')}>
      {explorerId ?? 'default'}
    </button>
  ),
  NavPageLayout: ({ children }: { children: React.ReactNode }) => children,
  ProjectWorkspaceTabs: ({
    children,
    toolbarContent,
  }: {
    children: React.ReactNode;
    toolbarContent?: React.ReactNode;
  }) => (
    <>
      {toolbarContent}
      {children}
    </>
  ),
}));

describe('project Explorer Builder route', () => {
  it('opens the requested Explorer and keeps later selections in the URL', () => {
    const replace = jest.fn().mockResolvedValue(true);
    (useRouter as jest.Mock).mockReturnValue({
      pathname: '/org/[org]/project/[project]/explorers/builder',
      query: {
        org: 'HTAN_INT',
        project: 'BForePC',
        explorerId: 'test',
      },
      replace,
    });

    render(
      <ProjectExplorerBuilder
        headerProps={{
          topBar: { items: [] },
          navigation: { items: [] },
          leftnav: [],
          basePage: false,
        }}
        footerProps={{ basePage: false }}
        headerMetadata={{
          title: 'Explorer Builder',
          content: '',
          key: 'builder',
        }}
        pageProblems={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'test' }));

    expect(screen.getByText('View').closest('a')).toHaveAttribute(
      'href',
      '/Explorer/HTAN_INT%2FBForePC',
    );
    expect(screen.getByText('View Builder').closest('a')).toHaveAttribute(
      'href',
      '/org/HTAN_INT/project/BForePC/explorers/views',
    );
    expect(screen.getByText('Dataframe Builder')).toBeInTheDocument();

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: '/org/[org]/project/[project]/explorers/builder',
        query: {
          org: 'HTAN_INT',
          project: 'BForePC',
          explorerId: 'second',
        },
      },
      undefined,
      { shallow: true },
    );
  });
});

describe('Builder route availability', () => {
  it('loads the Builder route without deployment configuration', async () => {
    await expect(
      getServerSideProps({} as GetServerSidePropsContext),
    ).resolves.toEqual({
      props: {},
    });
  });
});
