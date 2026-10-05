/** @jest-environment jsdom */

import { handleUnauthorizedStatus } from './unauthorized';

describe('handleUnauthorizedStatus', () => {
  it('asks the session provider to verify a 401 before logout', () => {
    const verify = jest.fn();
    const logout = jest.fn();
    window.addEventListener('gen3-verify-session', verify);
    window.addEventListener('gen3-force-logout', logout);

    expect(handleUnauthorizedStatus(401)).toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();

    window.removeEventListener('gen3-verify-session', verify);
    window.removeEventListener('gen3-force-logout', logout);
  });

  it('does not react to a permission failure', () => {
    const verify = jest.fn();
    window.addEventListener('gen3-verify-session', verify);

    expect(handleUnauthorizedStatus(403)).toBe(false);
    expect(verify).not.toHaveBeenCalled();

    window.removeEventListener('gen3-verify-session', verify);
  });
});
