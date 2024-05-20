import { JSONObject } from '../../types';
import { GEN3_GRIP_API } from '../../constants';
import { getCookie } from 'cookies-next';
import { selectCSRFToken } from '../user';
import { CoreState } from '../../reducers';

export interface gripApiResponse<H = JSONObject> {
  readonly data: H;
}

export interface gripApiSliceRequest {
  readonly query: string;
  readonly variables?: Record<string, unknown>;
}

export const gripApiFetch = async <T>(
  query: gripApiSliceRequest,
  headers: Record<string, string>,
): Promise<gripApiResponse<T>> => {
  const res = await fetch(`${GEN3_GRIP_API}/${query.endpoint_arg}`, {
    headers: headers,
    method: 'POST',
    body: JSON.stringify(query),
  });
  if (res.ok) return res.json();

  throw await buildGripFetchError(res);
};

const buildGripFetchError = async (
  res: Response,
): Promise<Object> => {
  const errorData = await res.json();
  return {
    text: errorData.Message,
    code: errorData.StatusCode
  };
};

  export const gripApi = coreCreateApi({
    reducerPath: 'grip',
    baseQuery: async (request: gripApiSliceRequest, api) => {
      const csrfToken = selectCSRFToken(api.getState() as CoreState);

      let accessToken = undefined;
      if (process.env.NODE_ENV === 'development') {
        // NOTE: This cookie can only be accessed from the client side
        // in development mode. Otherwise, the cookie is set as httpOnly
        accessToken = getCookie('credentials_token');
      }
      const  headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...(accessToken && { 'Authorization': `bearer ${accessToken}` }),
    };

    console.log("HEADERS: ", headers);
    try {
      const results = await gripApiFetch(request, headers);
      return { data: results };
    } catch (e) {
      return { error: e };
    }
  },
  endpoints: () => ({}),
});

export const { useGetGripQuery} = gripApi;
*/