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
    defineSamplePageLoader: jest.fn(() => jest.fn()),
  }),
  { virtual: true },
);

jest.mock('@gen3/frontend', () => ({
  isExplorerBuilderEnabled: () =>
    process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED === 'true',
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
  ProjectWorkspaceTabs: ({ children }: { children: React.ReactNode }) =>
    children,
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
  it('returns 404 before loading the page when Builder is disabled', async () => {
    const original = process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
    delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
    try {
      await expect(
        getServerSideProps({} as GetServerSidePropsContext),
      ).resolves.toEqual({ notFound: true });
    } finally {
      if (original === undefined)
        delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
      else process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = original;
    }
  });
});
