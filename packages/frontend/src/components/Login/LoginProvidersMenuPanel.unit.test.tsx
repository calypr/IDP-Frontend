import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import LoginProvidersMenuPanel from './LoginProvidersMenuPanel';

const useGetLoginProvidersQuery = jest.fn();
jest.mock('@gen3/core', () => ({
  useGetLoginProvidersQuery: () => useGetLoginProvidersQuery(),
}));

it('keeps a stable login control while providers load', () => {
  useGetLoginProvidersQuery.mockReturnValue({ data: undefined });
  const view = render(
    <MantineProvider>
      <LoginProvidersMenuPanel
        classNames={{ button: '', label: '' }}
        handleLoginSelected={jest.fn()}
      />
    </MantineProvider>,
  );
  expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();

  useGetLoginProvidersQuery.mockReturnValue({
    data: {
      providers: [{ name: 'Google', urls: [{ name: 'Google', url: '/user/login/google' }] }],
    },
  });
  view.rerender(
    <MantineProvider>
      <LoginProvidersMenuPanel
        classNames={{ button: '', label: '' }}
        handleLoginSelected={jest.fn()}
      />
    </MantineProvider>,
  );
  expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
});
