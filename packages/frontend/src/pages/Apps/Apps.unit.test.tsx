import React from 'react';
import { render, screen } from '@testing-library/react';
import AppsPage from './Apps';
import type { AppsPageProps } from './types';

const useGetGeckoProjectsQuery = jest.fn();
const useGetGeckoProjectSummaryQuery = jest.fn();

jest.mock('@gen3/core', () => ({
  useGetGeckoProjectsQuery: () => useGetGeckoProjectsQuery(),
  useGetGeckoProjectSummaryQuery: () => useGetGeckoProjectSummaryQuery(),
}));
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../features/Navigation', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const pageProps = {
  headerProps: {},
  footerProps: {},
  headerMetadata: {},
} as AppsPageProps;

it('waits for both project catalog requests before mounting content', () => {
  useGetGeckoProjectsQuery.mockReturnValue({ isLoading: true });
  useGetGeckoProjectSummaryQuery.mockReturnValue({
    data: [],
    isLoading: true,
  });
  const view = render(<AppsPage {...pageProps} />);
  expect(screen.queryByText('No Gecko projects are currently available.')).toBeNull();

  useGetGeckoProjectsQuery.mockReturnValue({ isLoading: false });
  useGetGeckoProjectSummaryQuery.mockReturnValue({
    data: [],
    isLoading: true,
  });
  view.rerender(<AppsPage {...pageProps} />);
  expect(screen.queryByText('No Gecko projects are currently available.')).toBeNull();

  useGetGeckoProjectSummaryQuery.mockReturnValue({
    data: [],
    isLoading: false,
  });
  view.rerender(<AppsPage {...pageProps} />);
  expect(
    screen.getByText('No Gecko projects are currently available.'),
  ).toBeVisible();
});
