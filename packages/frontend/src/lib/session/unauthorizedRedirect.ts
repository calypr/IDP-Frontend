const DEFAULT_RETURN_PATH = '/';

export type ForcedLogoutAction = 'redirect' | 'background' | 'ignore';

export const getForcedLogoutAction = ({
  showLoginModal,
  redirectStarted,
  logoutInFlight,
}: {
  showLoginModal: boolean;
  redirectStarted: boolean;
  logoutInFlight: boolean;
}): ForcedLogoutAction => {
  if (showLoginModal) {
    return redirectStarted ? 'ignore' : 'redirect';
  }

  return redirectStarted || logoutInFlight ? 'ignore' : 'background';
};

const hasUnsafePathPrefix = (currentPath: string): boolean => {
  let pathname = currentPath.split(/[?#]/, 1)[0];

  for (let decodeCount = 0; decodeCount < 2; decodeCount += 1) {
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      return true;
    }
  }

  const hasControlCharacter = Array.from(pathname).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

  return (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.startsWith('/\\') ||
    hasControlCharacter
  );
};

export const getSafeSessionReturnPath = (
  currentPath: string | undefined,
): string => {
  if (
    !currentPath ||
    hasUnsafePathPrefix(currentPath) ||
    currentPath.startsWith('/Login')
  ) {
    return DEFAULT_RETURN_PATH;
  }

  return currentPath;
};

export const buildSessionExpiredLoginUrl = ({
  fenceApi,
  redirectUrl,
  currentPath,
}: {
  fenceApi: string;
  redirectUrl: string;
  currentPath: string | undefined;
}): string => {
  const returnPath = getSafeSessionReturnPath(currentPath);
  const loginUrl = `${redirectUrl.replace(/\/$/, '')}/Login?referer=${encodeURIComponent(returnPath)}`;

  return `${fenceApi.replace(/\/$/, '')}/logout?next=${encodeURIComponent(loginUrl)}`;
};
