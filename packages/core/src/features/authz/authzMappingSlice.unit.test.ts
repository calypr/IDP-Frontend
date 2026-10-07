import { configureStore } from '@reduxjs/toolkit';
import { authzApi } from './authzMappingSlice';
import { userAuthApi } from '../user/userSliceRTK';

const createStore = () =>
  configureStore({
    reducer: {
      [authzApi.reducerPath]: authzApi.reducer,
      [userAuthApi.reducerPath]: userAuthApi.reducer,
    },
    middleware: (defaults) =>
      defaults().concat(authzApi.middleware, userAuthApi.middleware),
  });

describe('Fence access mapping', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports an incomplete user response as unavailable access data', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ username: 'active-user' }), {
        status: 200,
      }),
    );

    const store = createStore();
    const result = await store.dispatch(
      authzApi.endpoints.getAuthzMappings.initiate(),
    );

    expect(result).toMatchObject({
      error: {
        status: 'CUSTOM_ERROR',
        error: 'Fence user response did not include an access mapping',
      },
    });
  });

  it('retries Fence when cached user details lack an access mapping', async () => {
    let requests = 0;
    global.fetch = jest.fn(async () => {
      requests += 1;
      return new Response(
        JSON.stringify(
          requests === 1
            ? { username: 'active-user' }
            : {
                username: 'active-user',
                authz: {
                  '/programs/HTAN_INT/projects/BForePC': [
                    { method: 'read', service: 'arborist' },
                  ],
                },
              },
        ),
        { status: 200 },
      );
    });

    const store = createStore();
    await store.dispatch(userAuthApi.endpoints.fetchUserDetails.initiate());
    const result = await store.dispatch(
      authzApi.endpoints.getAuthzMappings.initiate(),
    );

    expect(requests).toBe(2);
    expect(result).toMatchObject({
      data: {
        '/programs/HTAN_INT/projects/BForePC': [
          { method: 'read', service: 'arborist' },
        ],
      },
    });
  });
});
