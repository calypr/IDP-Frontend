import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExplorerBuilderClient as ExplorerBuilderPage } from './ExplorerBuilderClient';

const mockCreateLoomClient = jest.fn((_options: unknown) => ({
  getBuilder: jest.fn(),
}));
const mockLoomExplorerBuilder = jest.fn((_props: Record<string, unknown>) => (
  <div>Loom Builder</div>
));
const mockSelectCSRFToken = jest.fn(
  (_state: unknown): string | undefined => 'csrf-current',
);
const mockSelectUserDetails = jest.fn((_state: unknown) => ({ sub: 'user-1' }));
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
  selectUserDetails: (state: unknown) => mockSelectUserDetails(state),
  useCoreSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

jest.mock('../../components/Protected', () => ({
  ProtectedContent: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ExplorerBuilderPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectCSRFToken.mockReturnValue('csrf-current');
    mockSelectUserDetails.mockReturnValue({ sub: 'user-1' });
  });

  it('creates the Loom client with the Calypr API without caching CSRF headers', () => {
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
    });
  });

  it('keeps Calypr Loom requests on the shared auth boundary with the latest CSRF token', async () => {
    const response = { status: 401 } as Response;
    mockFetchLoomResponse.mockResolvedValue(response);

    const { rerender } = render(
      <ExplorerBuilderPage organization="HTAN_INT" project="BForePC" />,
    );

    const config = mockCreateLoomClient.mock.calls[0][0] as {
      fetch: typeof globalThis.fetch;
    };

    mockSelectCSRFToken.mockReturnValue('csrf-refreshed');
    rerender(<ExplorerBuilderPage organization="HTAN_INT" project="BForePC" />);
    await config.fetch('/loom/api/v1/projects/example', {
      method: 'GET',
      headers: { 'X-CSRF-Token': 'csrf-stale' },
    });

    const latestRequest = mockFetchLoomResponse.mock.calls[0][1] as RequestInit;
    expect(new Headers(latestRequest.headers).get('X-CSRF-Token')).toBe(
      'csrf-refreshed',
    );
    expect(mockHandleUnauthorizedStatus).toHaveBeenCalledWith(401);

    mockSelectCSRFToken.mockReturnValue(undefined);
    rerender(<ExplorerBuilderPage organization="HTAN_INT" project="BForePC" />);
    await config.fetch('/loom/api/v1/projects/example', {
      method: 'GET',
      headers: { 'X-CSRF-Token': 'csrf-stale' },
    });

    const clearedRequest = mockFetchLoomResponse.mock.calls[1][1] as RequestInit;
    expect(new Headers(clearedRequest.headers).has('X-CSRF-Token')).toBe(false);
    expect(mockCreateLoomClient).toHaveBeenCalledTimes(1);
  });

  it('creates a new client when the authenticated principal changes', () => {
    const { rerender } = render(
      <ExplorerBuilderPage organization="HTAN_INT" project="BForePC" />,
    );
    const firstClientFetch = (
      mockCreateLoomClient.mock.calls[0][0] as {
        fetch: typeof globalThis.fetch;
      }
    ).fetch;

    mockSelectUserDetails.mockReturnValue({ sub: 'user-2' });
    rerender(<ExplorerBuilderPage organization="HTAN_INT" project="BForePC" />);

    expect(mockCreateLoomClient).toHaveBeenCalledTimes(2);
    expect(
      (
        mockCreateLoomClient.mock.calls[1][0] as {
          fetch: typeof globalThis.fetch;
        }
      ).fetch,
    ).not.toBe(firstClientFetch);
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
