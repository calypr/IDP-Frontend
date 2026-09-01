/** @jest-environment jsdom */

import {
  handleUnauthorizedStatus,
  requestSessionLogout,
} from '../unauthorized';

describe('unauthorized response handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches a login-requesting logout event for 401', () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');

    expect(handleUnauthorizedStatus(401)).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    const event = dispatchEvent.mock.calls[0][0] as CustomEvent<{
      showLoginModal: boolean;
    }>;
    expect(event.type).toBe('gen3-force-logout');
    expect(event.detail).toEqual({ showLoginModal: true });
  });

  it.each([undefined, 200, 403, 409, 500])(
    'does not change authentication state for status %p',
    (status) => {
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');

      expect(handleUnauthorizedStatus(status)).toBe(false);
      expect(dispatchEvent).not.toHaveBeenCalled();
    },
  );

  it('allows callers to request a background logout explicitly', () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');

    requestSessionLogout({ showLoginModal: false });

    const event = dispatchEvent.mock.calls[0][0] as CustomEvent<{
      showLoginModal: boolean;
    }>;
    expect(event.detail).toEqual({ showLoginModal: false });
  });
});
