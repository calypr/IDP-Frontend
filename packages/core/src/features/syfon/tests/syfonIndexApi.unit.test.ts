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
            controlled_access: ['/organization/org-a/project/proj-a'],
            did: 'did-1',
            file_name: 'nested/a.txt',
            size: 11,
          },
          {
            controlled_access: ['/organization/org-a'],
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

    expect(result.data).toEqual([
      {
        controlled_access: ['/organization/org-a/project/proj-a'],
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
    ]);
  });
});
