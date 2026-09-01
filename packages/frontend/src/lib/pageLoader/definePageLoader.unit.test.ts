jest.mock('./context', () => ({ createServerPageContext: jest.fn() }));

import { createServerPageContext } from './context';
import { definePageLoader } from './definePageLoader';

const navigation = {
  headerProps: {
    topBar: { items: [], loginButtonVisibility: 'hidden' },
    navigation: { items: [] },
    leftnav: [],
    basePage: false,
  },
  footerProps: { rightSection: { columns: [], basePage: false }, basePage: false },
  headerMetadata: { title: 'Test', content: 'Test', key: 'test' },
};

const nextContext = () =>
  ({
    req: { headers: {} },
    res: { statusCode: 200 },
    query: {},
    params: {},
    resolvedUrl: '/',
  }) as any;

const serverContext = (overrides: Record<string, unknown> = {}) =>
  ({
    problems: { all: [], add: jest.fn() },
    loadNavigation: jest.fn().mockResolvedValue(navigation),
    ...overrides,
  }) as any;

describe('definePageLoader', () => {
  beforeEach(() => jest.resetAllMocks());

  it('combines navigation, data, and collected warnings', async () => {
    const warning = {
      severity: 'warning',
      source: 'config',
      status: 500,
      message: 'fallback',
      retryable: false,
    } as const;
    (createServerPageContext as jest.Mock).mockReturnValue(
      serverContext({
        problems: {
          all: [{ ...warning, configPath: undefined }],
          add: jest.fn(),
        },
      }),
    );
    const loader = definePageLoader({
      name: 'Example',
      loadNavigation: jest.fn(),
      load: async () => ({ configuration: { enabled: true } }),
    });

    await expect(loader(nextContext())).resolves.toStrictEqual({
      props: {
        ...navigation,
        configuration: { enabled: true },
        pageProblems: [warning],
      },
    });
  });

  it('uses the data failure status before a navigation failure', async () => {
    (createServerPageContext as jest.Mock).mockReturnValue(
      serverContext({
        loadNavigation: jest.fn().mockRejectedValue(
          Object.assign(new Error('navigation failed'), { status: 502 }),
        ),
      }),
    );
    const context = nextContext();
    const loader = definePageLoader({
      name: 'Example',
      loadNavigation: jest.fn(),
      load: async () => {
        throw Object.assign(new Error('forbidden'), { status: 403 });
      },
      fallback: () => ({ configuration: null }),
    });

    const result = (await loader(context)) as any;
    expect(context.res.statusCode).toBe(403);
    expect(result.props.configuration).toBeNull();
    expect(result.props.pageProblems).toHaveLength(2);
  });

  it('passes redirects through unchanged', async () => {
    (createServerPageContext as jest.Mock).mockReturnValue(serverContext());
    const loader = definePageLoader({
      name: 'Redirect',
      loadNavigation: jest.fn(),
      load: async () => ({
        kind: 'redirect' as const,
        redirect: { destination: '/login', permanent: false },
      }),
    });

    await expect(loader(nextContext())).resolves.toEqual({
      redirect: { destination: '/login', permanent: false },
    });
  });
});
