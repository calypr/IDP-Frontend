import { useMemo, useRef } from 'react';
import {
  GEN3_LOOM_API,
  fetchLoomResponse,
  handleUnauthorizedStatus,
  selectCSRFToken,
  useCoreSelector,
  type CoreState,
} from '@gen3/core';
import { createLoomClient } from '@calypr/loom-ui';
import type { LoomClient } from '@calypr/loom-ui';

export const createAuthenticatedLoomFetch = (
  csrfTokenRef: { readonly current: string | undefined },
): typeof globalThis.fetch =>
  async (input, init) => {
    const endpoint =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const headers = new Headers(init?.headers);
    headers.delete('X-CSRF-Token');
    if (csrfTokenRef.current) headers.set('X-CSRF-Token', csrfTokenRef.current);
    const response = await fetchLoomResponse(endpoint, {
      ...init,
      headers,
    });
    handleUnauthorizedStatus(response.status);
    return response;
  };

export const createAuthenticatedLoomClient = (
  csrfTokenRef: { readonly current: string | undefined },
): LoomClient =>
  createLoomClient({
    baseUrl: GEN3_LOOM_API,
    credentials: 'include',
    fetch: createAuthenticatedLoomFetch(csrfTokenRef),
  });

export const useAuthenticatedLoomClient = (): LoomClient => {
  const csrfToken = useCoreSelector((state: CoreState) =>
    selectCSRFToken(state),
  );
  const csrfTokenRef = useRef(csrfToken);
  csrfTokenRef.current = csrfToken;
  return useMemo(() => createAuthenticatedLoomClient(csrfTokenRef), []);
};
