import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import ProjectExplorerBuilder from '../pages/org/[org]/project/[project]/explorers/builder';

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
        headerProps={{}}
        footerProps={{}}
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
