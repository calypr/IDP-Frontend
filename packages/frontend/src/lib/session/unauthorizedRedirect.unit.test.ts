import {
  buildSessionExpiredLoginUrl,
  getForcedLogoutAction,
  getSafeSessionReturnPath,
} from './unauthorizedRedirect';

describe('expired session login redirect', () => {
  it.each([
    [undefined, '/'],
    ['', '/'],
    ['https://attacker.example/path', '/'],
    ['//attacker.example/path', '/'],
    ['/%2Fattacker.example/path', '/'],
    ['/\\attacker.example/path', '/'],
    ['/projects/%E0%A4%A', '/'],
    ['/Login', '/'],
    ['/Login?referer=/projects', '/'],
    [
      '/projects/example?tab=files#details',
      '/projects/example?tab=files#details',
    ],
  ])('normalizes %p to %p', (currentPath, expected) => {
    expect(getSafeSessionReturnPath(currentPath)).toBe(expected);
  });

  it.each([
    [true, false, false, 'redirect'],
    [true, false, true, 'redirect'],
    [true, true, true, 'ignore'],
    [false, false, false, 'background'],
    [false, false, true, 'ignore'],
    [false, true, false, 'ignore'],
  ] as const)(
    'chooses %s/%s/%s as %s',
    (showLoginModal, redirectStarted, logoutInFlight, expected) => {
      expect(
        getForcedLogoutAction({
          showLoginModal,
          redirectStarted,
          logoutInFlight,
        }),
      ).toBe(expected);
    },
  );

  it('routes through Fence logout and preserves an internal return path', () => {
    expect(
      buildSessionExpiredLoginUrl({
        fenceApi: 'https://commons.example/user/',
        redirectUrl: 'https://commons.example/',
        currentPath: '/Explorer/test?project=demo',
      }),
    ).toBe(
      'https://commons.example/user/logout?next=' +
        encodeURIComponent(
          'https://commons.example/Login?referer=' +
            encodeURIComponent('/Explorer/test?project=demo'),
        ),
    );
  });
});
