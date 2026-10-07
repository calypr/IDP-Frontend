import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PageLoadBoundary from './PageLoadBoundary';

describe('PageLoadBoundary', () => {
  it('shows warnings without hiding page content', () => {
    render(
      <PageLoadBoundary
        problems={[
          {
            severity: 'warning',
            source: 'config',
            status: 500,
            message: 'Using fallback configuration',
            retryable: false,
          },
        ]}
      >
        <div>Page content</div>
      </PageLoadBoundary>,
    );

    expect(screen.getByText('Using fallback configuration')).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('replaces content with blocking errors and exposes request metadata', () => {
    render(
      <PageLoadBoundary
        problems={[
          {
            severity: 'error',
            source: 'loom',
            status: 503,
            message: 'Dataframe backend unavailable',
            code: 'BACKEND_UNAVAILABLE',
            requestId: 'request-123',
            retryable: true,
          },
        ]}
      >
        <div>Hidden content</div>
      </PageLoadBoundary>,
    );

    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    expect(screen.getByText('Dataframe backend unavailable')).toBeInTheDocument();
    expect(screen.getByText(/request request-123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders validation issue paths', () => {
    render(
      <PageLoadBoundary
        problems={[
          {
            severity: 'error',
            source: 'config',
            status: 500,
            message: 'Invalid configuration',
            retryable: false,
            issues: [{ path: '$.modes.0.endpoint', message: 'Unknown endpoint' }],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Configuration details'));
    expect(screen.getByText('$.modes.0.endpoint')).toBeInTheDocument();
  });
});
