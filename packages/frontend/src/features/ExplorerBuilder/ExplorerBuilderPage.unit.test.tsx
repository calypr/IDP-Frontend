import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExplorerBuilderPage } from './ExplorerBuilderPage';

const mockCreateLoomClient = jest.fn((_options: unknown) => ({
  getBuilder: jest.fn(),
}));
const mockLoomExplorerBuilder = jest.fn(
  (_props: Record<string, unknown>) => <div>Loom Builder</div>,
);
const mockSelectCSRFToken = jest.fn((_state: unknown) => 'csrf-current');
const mockFetchLoomResponse = jest.fn();
const mockHandleUnauthorizedStatus = jest.fn();

jest.mock('@calypr/loom-ui/styles.css', () => ({}), { virtual: true });
jest.mock('@calypr/loom-ui', () => ({
  createLoomClient: (options: unknown) => mockCreateLoomClient(options),
  LoomExplorerBuilder: (props: Record<string, unknown>) =>
    mockLoomExplorerBuilder(props),
}));

jest.mock('@gen3/core', () => ({
  GEN3_LOOM_API: '/loom',
  fetchLoomResponse: (endpoint: string, init: RequestInit) =>
    mockFetchLoomResponse(endpoint, init),
  handleUnauthorizedStatus: (status: number) =>
    mockHandleUnauthorizedStatus(status),
  selectCSRFToken: (state: unknown) => mockSelectCSRFToken(state),
  useCoreSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

jest.mock('../../components/Protected', () => ({
  ProtectedContent: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ExplorerBuilderPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the Loom client with the Calypr API and current CSRF token', () => {
    render(
      <ExplorerBuilderPage
        organization="HTAN_INT"
        project="BForePC"
        explorerId="test"
      />,
    );

    expect(mockSelectCSRFToken).toHaveBeenCalledWith({});
    expect(mockCreateLoomClient).toHaveBeenCalledWith({
      baseUrl: '/loom',
      credentials: 'include',
      fetch: expect.any(Function),
      headers: { 'X-CSRF-Token': 'csrf-current' },
    });
  });

  it('keeps Calypr Loom requests on the shared auth boundary', async () => {
    const response = { status: 401 } as Response;
    mockFetchLoomResponse.mockResolvedValue(response);

    render(<ExplorerBuilderPage organization="HTAN_INT" project="BForePC" />);

    const config = mockCreateLoomClient.mock.calls[0][0] as {
      fetch: typeof globalThis.fetch;
    };
    await config.fetch('/loom/api/v1/projects/example', { method: 'GET' });

    expect(mockFetchLoomResponse).toHaveBeenCalledWith(
      '/loom/api/v1/projects/example',
      { method: 'GET' },
    );
    expect(mockHandleUnauthorizedStatus).toHaveBeenCalledWith(401);
  });

  it('passes the route identity and selection callback to the Loom Builder', () => {
    const onExplorerChange = jest.fn();

    render(
      <ExplorerBuilderPage
        organization="HTAN_INT"
        project="BForePC"
        explorerId="test"
        onExplorerChange={onExplorerChange}
      />,
    );

    expect(screen.getByText('Loom Builder')).toBeInTheDocument();
    expect(mockLoomExplorerBuilder).toHaveBeenCalledWith({
      client: expect.objectContaining({ getBuilder: expect.any(Function) }),
      organization: 'HTAN_INT',
      project: 'BForePC',
      explorerId: 'test',
      onExplorerChange,
    });
  });
});
