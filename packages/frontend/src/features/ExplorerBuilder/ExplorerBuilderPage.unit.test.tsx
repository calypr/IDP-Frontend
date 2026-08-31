import React from 'react';
import { render, screen } from '@testing-library/react';
import BuilderWorkspace from './BuilderWorkspace';
import { ExplorerBuilderPage } from './ExplorerBuilderPage';

jest.mock('../../components/Protected', () => ({
  ProtectedContent: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('./BuilderWorkspace', () => ({
  __esModule: true,
  default: jest.fn(() => <div>Builder workspace</div>),
}));

describe('ExplorerBuilderPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the Explorer selected by the route', () => {
    const onExplorerChange = jest.fn();

    render(
      <ExplorerBuilderPage
        organization="HTAN_INT"
        project="BForePC"
        explorerId="test"
        onExplorerChange={onExplorerChange}
      />,
    );

    expect(screen.getByText('Builder workspace')).toBeInTheDocument();
    expect((BuilderWorkspace as jest.Mock).mock.calls[0][0]).toEqual({
      organization: 'HTAN_INT',
      project: 'BForePC',
      explorerId: 'test',
      onExplorerChange,
    });
  });

  it('leaves the Explorer unspecified when the route has no selection', () => {
    render(<ExplorerBuilderPage organization="HTAN_INT" project="BForePC" />);

    expect((BuilderWorkspace as jest.Mock).mock.calls[0][0].explorerId).toBe(
      undefined,
    );
  });
});
