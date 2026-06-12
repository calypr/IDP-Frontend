import { GEN3_API } from '../../../constants';
import { setupCoreStore } from '../../../store';
import { syfonIndexApi } from '../syfonIndexApi';

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

describe('syfonIndexApi', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists exact project records from the Syfon index endpoint', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      expect(url).toBe(
        `${GEN3_API}/index?organization=org-a&project=proj-a&limit=250&page=2`,
      );

      return jsonResponse({
        records: [
          {
            controlled_access: ['/programs/org-a/projects/proj-a'],
            did: 'did-1',
            file_name: 'nested/a.txt',
            size: 11,
          },
          {
            controlled_access: ['/programs/org-a'],
            did: 'did-2',
            file_name: 'nested/b.txt',
            size: 22,
          },
          {
            did: 'did-3',
            file_name: 'nested/c.txt',
            organization: 'org-a',
            project: 'proj-a',
            size: 33,
          },
        ],
      });
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonIndexApi.endpoints.getSyfonIndexRecords.initiate({
        limit: 250,
        organization: 'org-a',
        page: 2,
        project: 'proj-a',
      }),
    );

    expect(result.data).toEqual({
      directories: [],
      records: [
        {
          controlled_access: ['/programs/org-a/projects/proj-a'],
          did: 'did-1',
          file_name: 'nested/a.txt',
          size: 11,
        },
        {
          did: 'did-3',
          file_name: 'nested/c.txt',
          organization: 'org-a',
          project: 'proj-a',
          size: 33,
        },
      ],
    });
  });

  it('returns only the requested page for default browse mode', async () => {
    const store = setupCoreStore();
    const urls: Array<string> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      urls.push(url);

      if (
        url ===
        `${GEN3_API}/index?organization=org-a&project=proj-a&limit=2`
      ) {
        return jsonResponse({
          records: [
            {
              controlled_access: ['/programs/org-a/projects/proj-a'],
              did: 'did-1',
              file_name: 'nested/a.txt',
              size: 11,
            },
            {
              controlled_access: ['/programs/org-a/projects/proj-a'],
              did: 'did-2',
              file_name: 'nested/b.txt',
              size: 22,
            },
          ],
        });
      }

      throw new Error(`unexpected URL ${url}`);
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonIndexApi.endpoints.getSyfonIndexRecords.initiate({
        limit: 2,
        organization: 'org-a',
        project: 'proj-a',
      }),
    );

    expect(urls).toEqual([
      `${GEN3_API}/index?organization=org-a&project=proj-a&limit=2`,
    ]);
    expect(result.data).toEqual({
      directories: [],
      records: [
        {
          controlled_access: ['/programs/org-a/projects/proj-a'],
          did: 'did-1',
          file_name: 'nested/a.txt',
          size: 11,
        },
        {
          controlled_access: ['/programs/org-a/projects/proj-a'],
          did: 'did-2',
          file_name: 'nested/b.txt',
          size: 22,
        },
      ],
    });
  });

  it('prefers explicit start over page when both are provided', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      expect(url).toBe(
        `${GEN3_API}/index?organization=org-a&project=proj-a&limit=250&start=did-99`,
      );

      return jsonResponse({
        records: [
          {
            controlled_access: ['/programs/org-a/projects/proj-a'],
            did: 'did-100',
            file_name: 'nested/z.txt',
            size: 44,
          },
        ],
      });
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonIndexApi.endpoints.getSyfonIndexRecords.initiate({
        limit: 250,
        organization: 'org-a',
        page: 2,
        project: 'proj-a',
        start: 'did-99',
      }),
    );

    expect(result.data).toEqual({
      directories: [],
      records: [
        {
          controlled_access: ['/programs/org-a/projects/proj-a'],
          did: 'did-100',
          file_name: 'nested/z.txt',
          size: 44,
        },
      ],
    });
  });

  it('passes path through and returns directories plus file records for browse mode', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      expect(url).toBe(
        `${GEN3_API}/index?organization=org-a&project=proj-a&limit=250&path=nested`,
      );

      return jsonResponse({
        directories: [
          { name: 'deep', path: 'nested/deep' },
        ],
        records: [
          {
            controlled_access: ['/programs/org-a/projects/proj-a'],
            did: 'did-1',
            file_name: 'nested/a.txt',
            size: 11,
          },
        ],
      });
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonIndexApi.endpoints.getSyfonIndexRecords.initiate({
        limit: 250,
        organization: 'org-a',
        path: 'nested',
        project: 'proj-a',
      }),
    );

    expect(result.data).toEqual({
      directories: [{ name: 'deep', path: 'nested/deep' }],
      records: [
        {
          controlled_access: ['/programs/org-a/projects/proj-a'],
          did: 'did-1',
          file_name: 'nested/a.txt',
          size: 11,
        },
      ],
    });
  });
});
