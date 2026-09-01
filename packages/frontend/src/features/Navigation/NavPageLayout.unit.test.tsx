import React from 'react';
import { render } from '@testing-library/react';
import NavPageLayout from './NavPageLayout';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./Header', () => ({
  __esModule: true,
  default: () => <header data-testid="navigation-header" />,
}));

jest.mock('./Footer/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="navigation-footer" />,
}));

jest.mock('./Sidebar', () => ({
  Sidebar: () => <aside data-testid="navigation-sidebar" />,
  useResponsiveSidebar: () => ({
    finalState: 'closed',
    toggleButton: jest.fn(),
  }),
}));

const layoutProps = {
  headerProps: {
    topBar: { items: [] },
    navigation: {},
    leftnav: [],
    basePage: false,
  },
  footerProps: { basePage: false },
  headerMetadata: {
    title: 'Navigation test',
    content: 'Navigation test',
    key: 'navigation-test',
  },
};

describe('NavPageLayout', () => {
  it('uses document layout by default without compensating padding', () => {
    const { container } = render(
      <NavPageLayout {...layoutProps} mainProps={{ id: 'page-main' }}>
        <div>content</div>
      </NavPageLayout>,
    );

    const root = container.firstElementChild as HTMLElement;
    const main = container.querySelector('main') as HTMLElement;

    expect(root).toHaveClass(
      'gen3-nav-page-layout',
      'gen3-nav-page-layout--document',
    );
    expect(main).toHaveAttribute('id', 'page-main');
    expect(main.className).not.toContain('pt-16');
    expect(main.className).not.toContain('pb-20');
    expect(root).toHaveStyle({ display: 'flex', minHeight: '100dvh' });
    expect(main).toHaveStyle({ flex: '1 1 auto', overflow: 'visible' });
  });

  it('uses viewport layout with stable initial size variables', () => {
    let measuredElements = 0;
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => {
        measuredElements += 1;
        return {
          height: measuredElements === 1 ? 64 : 80,
        } as DOMRect;
      });

    const { container } = render(
      <NavPageLayout {...layoutProps} layoutMode="viewport">
        <div>content</div>
      </NavPageLayout>,
    );

    const root = container.firstElementChild as HTMLElement;
    const body = container.querySelector(
      '.gen3-nav-page-layout__body',
    ) as HTMLElement;
    const main = container.querySelector('main') as HTMLElement;

    expect(root).toHaveClass('gen3-nav-page-layout--viewport');
    expect(root).toHaveStyle({ height: '100dvh', overflow: 'hidden' });
    expect(body).toHaveStyle({ minHeight: '0', overflow: 'hidden' });
    expect(main).toHaveStyle({
      display: 'flex',
      minHeight: '0',
      overflow: 'hidden',
    });
    expect(root.style.getPropertyValue('--gen3-header-height')).toBe('64px');
    expect(root.style.getPropertyValue('--gen3-footer-height')).toBe('80px');
  });
});
