import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  getSidebarResizeState,
  SIDEBAR_DESKTOP_QUERY,
  SidebarProvider,
  useSidebarContext,
} from './SidebarContext';

jest.mock('next/router', () => ({
  useRouter: () => ({ asPath: '/' }),
}));

const ContextProbe = () => {
  const { resizeState } = useSidebarContext();
  return <output data-testid="resize-state">{resizeState}</output>;
};

describe('SidebarContext', () => {
  const setMatchMedia = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches,
        media: SIDEBAR_DESKTOP_QUERY,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }),
    });
  };

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
    jest.restoreAllMocks();
  });

  it('uses matchMedia to identify desktop layout', () => {
    setMatchMedia(true);

    expect(getSidebarResizeState()).toBe('open');
  });

  it('starts hydration-safe and updates to the current compact state', async () => {
    setMatchMedia(false);

    render(
      <SidebarProvider>
        <ContextProbe />
      </SidebarProvider>,
    );

    expect(await screen.findByTestId('resize-state')).toHaveTextContent(
      'closed',
    );
  });
});
