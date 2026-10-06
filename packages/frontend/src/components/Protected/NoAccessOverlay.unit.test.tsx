import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { NoAccessOverlay } from './NoAccessOverlay';

const endSession = jest.fn();
jest.mock('../../lib/session/session', () => ({
  useSession: () => ({ status: 'issued', endSession }),
}));

describe('NoAccessOverlay', () => {
  beforeEach(() => endSession.mockClear());

  it('does not sign out automatically and lets the user switch accounts', () => {
    render(
      <MantineProvider>
        <NoAccessOverlay />
      </MantineProvider>,
    );
    expect(endSession).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out and switch account' }),
    );
    expect(endSession).toHaveBeenCalledTimes(1);
  });
});
