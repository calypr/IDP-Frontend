import {
  FetchError,
  FenceRequestFailure,
  Gen3FenceResponse,
} from './types';
import { GEN3_FENCE_API } from '../../constants';
import { FetchRequest } from './fenceApi';

export const isFetchError = <T>(obj: unknown): obj is FetchError<T> => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const { url, status, statusText, text } = obj as Partial<FetchError<T>>;

  return (
    typeof url === 'string' &&
    typeof status === 'number' &&
    typeof statusText === 'string' &&
    typeof text === 'string'
  );
};

/**
 * Template for fence error response dict
 * @returns: An error dict response from a RESTFUL API request
 */
export const buildFetchError = async <T>(
  res: Response,
  request?: T,
): Promise<FetchError<T>> => {
  return {
    url: res.url,
    status: res.status,
    statusText: res.statusText,
    text: await res.text(),
    request: request,
  };
};
/**
 * Template for a standard fence request
 * @returns: response data
 */
export const fetchFence = async <T>({
  endpoint,
  headers,
  body = {},
  method = 'GET',
  isJSON = true,
  signal,
  timeoutMs = 12_000,
}: FetchRequest): Promise<Gen3FenceResponse<T>> => {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${GEN3_FENCE_API}${endpoint}`, {
      method: method,
      credentials: 'include',
      headers: headers,
      body: 'POST' === method ? JSON.stringify(body) : null,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error: unknown) {
    const aborted = controller.signal.aborted;
    const failure: FenceRequestFailure<FetchRequest> = {
      kind: timedOut ? 'timeout' : aborted ? 'aborted' : 'network',
      url: `${GEN3_FENCE_API}${endpoint}`,
      status: timedOut ? 408 : 0,
      statusText: timedOut
        ? 'Fence request timed out'
        : aborted
          ? 'Fence request was aborted'
          : 'Fence request failed',
      text: error instanceof Error ? error.message : String(error),
      request: { endpoint, method, headers, body, isJSON, timeoutMs },
    };
    throw failure;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  if (res.ok)
    return {
      data: isJSON ? await res.json() : await res.text(),
      status: res.status,
    };

  const failure = await buildFetchError(res, {
    endpoint,
    method,
    headers,
    body,
  });
  throw { ...failure, kind: 'http' } satisfies FenceRequestFailure;
};
