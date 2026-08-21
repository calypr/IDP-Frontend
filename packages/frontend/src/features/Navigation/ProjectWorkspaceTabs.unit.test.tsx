import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  userHasMethodForServiceOnResource,
  useGetAuthzMappingsQuery,
  useGetExplorerStateV1Query,
} from '@gen3/core';
import ProjectWorkspaceTabs from './ProjectWorkspaceTabs';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@gen3/core', () => ({
  useGetAuthzMappingsQuery: jest.fn(),
  useGetExplorerStateV1Query: jest.fn(),
  userHasMethodForServiceOnResource: jest.fn(),
}));

const mockedAuthorization = userHasMethodForServiceOnResource as jest.Mock;

const renderTabs = (hasExplorerConfig = false) =>
  render(
    <ProjectWorkspaceTabs
      activeTab="git"
      hasExplorerConfig={hasExplorerConfig}
      organization="HTAN_INT"
      project="BForePC"
    >
      <div>Project content</div>
    </ProjectWorkspaceTabs>,
  );

describe('ProjectWorkspaceTabs', () => {
  beforeEach(() => {
    (useGetAuthzMappingsQuery as jest.Mock).mockReturnValue({ data: {} });
    (useGetExplorerStateV1Query as jest.Mock).mockReturnValue({ data: null });
    mockedAuthorization.mockReturnValue(false);
  });

  it('shows Explorer for an existing content or Loom configuration', () => {
    renderTabs(true);
    expect(screen.getByRole('tab', { name: 'Explorer' })).toHaveAttribute(
      'href',
      '/Explorer/HTAN_INT%2FBForePC',
    );
    expect(useGetExplorerStateV1Query).toHaveBeenCalledWith(
      { project: 'HTAN_INT/BForePC', explorerId: 'default' },
      { skip: true },
    );
  });

  it('shows Explorer to project updaters so they can create the first configuration', () => {
    mockedAuthorization.mockImplementation(
      (method: string) => method === 'update',
    );
    renderTabs(false);
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  it('does not add Explorer to an unconfigured read-only project', () => {
    mockedAuthorization.mockImplementation(
      (method: string) => method === 'read',
    );
    renderTabs(false);
    expect(
      screen.queryByRole('tab', { name: 'Explorer' }),
    ).not.toBeInTheDocument();
  });
});
