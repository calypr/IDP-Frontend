export interface ProjectPresentationConfigResponse {
  readonly presentationConfig: string;
  readonly success: boolean;
}

export const projectPresentationConfigPath = (
  organization: string,
  project: string,
): string =>
  `/api/gecko/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/presentationConfig`;

export const fetchProjectPresentationConfig = async (
  path: string,
): Promise<string> => {
  const response = await fetch(path, {
    credentials: 'include',
  });

  if (response.status === 404 || response.status === 204) {
    return '';
  }

  const payload = (await response.json().catch(() => null)) as
    | Partial<ProjectPresentationConfigResponse>
    | { error?: unknown }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error ?? '')
        : `Failed to fetch presentation config (${response.status})`;
    throw new Error(message);
  }

  if (payload && typeof payload === 'object') {
    const typedPayload = payload as Partial<ProjectPresentationConfigResponse>;
    if (typeof typedPayload.presentationConfig === 'string') {
      return typedPayload.presentationConfig;
    }
  }

  return '';
};

export const saveProjectPresentationConfig = async (
  path: string,
  presentationConfig: string,
): Promise<string> => {
  const response = await fetch(path, {
    body: JSON.stringify({ presentationConfig }),
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    method: 'PUT',
  });

  const payload = (await response.json().catch(() => null)) as
    | Partial<ProjectPresentationConfigResponse>
    | { error?: unknown }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error ?? '')
        : `Failed to save presentation config (${response.status})`;
    throw new Error(message);
  }

  if (payload && typeof payload === 'object') {
    const typedPayload = payload as Partial<ProjectPresentationConfigResponse>;
    if (typeof typedPayload.presentationConfig === 'string') {
      return typedPayload.presentationConfig;
    }
  }

  return presentationConfig;
};
