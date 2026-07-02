const FORCE_LOGOUT_EVENT = 'gen3-force-logout';

export const requestSessionLogout = ({
  showLoginModal = true,
}: {
  showLoginModal?: boolean;
} = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(FORCE_LOGOUT_EVENT, {
      detail: {
        showLoginModal,
      },
    }),
  );
};

export const handleUnauthorizedStatus = (
  status: number | undefined,
  options?: { showLoginModal?: boolean },
): boolean => {
  if (status !== 401) {
    return false;
  }

  requestSessionLogout(options);
  return true;
};
