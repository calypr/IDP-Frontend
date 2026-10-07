import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import NavigationLogo from './NavigationLogo';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('CALYPR navigation title', () => {
  const logo = {
    src: '/icons/calypr.svg',
    description: 'OHSU',
    title: 'CALYPR',
    href: '/',
  };

  it('opens the project catalog from an application page', () => {
    render(
      <MantineProvider>
        <NavigationLogo {...logo} basepage={false} />
      </MantineProvider>,
    );
    expect(screen.getByRole('link', { name: 'CALYPR' })).toHaveAttribute(
      'href',
      '/Apps',
    );
    expect(screen.getByRole('link', { name: 'OHSU' })).toHaveAttribute(
      'href',
      '/Apps',
    );
  });

  it('keeps the public landing page title at home', () => {
    render(
      <MantineProvider>
        <NavigationLogo {...logo} basepage />
      </MantineProvider>,
    );
    expect(screen.getByRole('link', { name: 'CALYPR' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'OHSU' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('routes a mixed-case CALYPR title away from the current home page', () => {
    render(
      <MantineProvider>
        <NavigationLogo {...logo} title="cALypR" basepage={false} />
      </MantineProvider>,
    );
    expect(screen.getByRole('link', { name: 'cALypR' })).toHaveAttribute(
      'href',
      '/Apps',
    );
  });
});
