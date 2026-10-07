const FORCE_LOGOUT_EVENT = 'gen3-force-logout';
export const VERIFY_SESSION_EVENT = 'gen3-verify-session';

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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VERIFY_SESSION_EVENT, { detail: options }));
  }
  return true;
};
