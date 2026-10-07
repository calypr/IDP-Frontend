import { configureStore } from '@reduxjs/toolkit';
import { explorerConfigApi } from './explorerConfigApi';
import { userAuthApi } from '../user/userSliceRTK';

describe('Explorer config discovery', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reads the Explorer list instead of the public project list', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify(['HTAN_INT-BForePC']), { status: 200 }),
    );
    const store = configureStore({
      reducer: {
        [explorerConfigApi.reducerPath]: explorerConfigApi.reducer,
        [userAuthApi.reducerPath]: userAuthApi.reducer,
      },
      middleware: (defaults) =>
        defaults().concat(explorerConfigApi.middleware, userAuthApi.middleware),
    });

    const result = await store.dispatch(
      explorerConfigApi.endpoints.getConfigList.initiate(),
    );

    const request = (global.fetch as jest.Mock).mock.calls[0][0] as Request;
    expect(request.url).toContain('/gecko/explorer/list');
    expect(result).toMatchObject({
      data: { success: true, data: ['HTAN_INT-BForePC'] },
    });
  });
});
