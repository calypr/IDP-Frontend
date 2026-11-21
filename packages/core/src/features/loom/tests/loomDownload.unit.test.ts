import { downloadLoomFile } from '../loomDownload';
import { fetchLoomGraphQL } from '../loomApi';

jest.mock('../loomApi', () => ({
  ...jest.requireActual('../loomApi'),
  fetchLoomGraphQL: jest.fn(),
}));
const fetchPage = jest.mocked(fetchLoomGraphQL);
const parameters = {
  selector: {
    recipe: 'metadata',
    translationVersion: 'r1',
    output: 'ResearchSubject',
  },
  projectIds: ['HTAN_INT/BForePC'],
  fields: ['identifier', 'diagnosis'],
  format: 'csv' as const,
  exportHeaders: { identifier: 'Participant', diagnosis: 'Diagnosis' },
};
const page = (
  rows: unknown[],
  hasNextPage = false,
  endCursor?: string,
  revision = 'r1',
) => ({
  dataframeRows: {
    materialization: { id: 'published-1', revision },
    columns: ['diagnosis', 'identifier'],
    rows,
    pageInfo: { hasNextPage, endCursor },
  },
});
const blobText = (blob: Blob): Promise<string> => blob.text();

beforeEach(() => jest.resetAllMocks());

it('exports every cursor page in configured column order with readable CSV headers and escaping', async () => {
  fetchPage
    .mockResolvedValueOnce(page([['A,"B"\nC', 'P1']], true, 'cursor-1'))
    .mockResolvedValueOnce(page([{ identifier: 'P2', diagnosis: ['D', 'E'] }]));
  const blob = await downloadLoomFile(parameters);
  expect(await blobText(blob)).toBe(
    'Participant,Diagnosis\r\nP1,"A,""B""\nC"\r\nP2,"[""D"",""E""]"\r\n',
  );
  expect(fetchPage.mock.calls[0][0].variables?.input).toMatchObject({
    projectId: 'HTAN_INT/BForePC',
    columns: ['identifier', 'diagnosis'],
    first: 1000,
  });
  expect(fetchPage.mock.calls[1][0].variables?.input).toMatchObject({
    after: 'cursor-1',
  });
});

it('returns headers for an empty result', async () => {
  fetchPage.mockResolvedValueOnce(page([]));
  expect(await blobText(await downloadLoomFile(parameters))).toBe(
    'Participant,Diagnosis\r\n',
  );
});

it('rejects a publication change without producing a partial download', async () => {
  fetchPage
    .mockResolvedValueOnce(page([['A', 'P1']], true, 'next'))
    .mockResolvedValueOnce(page([['B', 'P2']], false, undefined, 'r2'));
  await expect(downloadLoomFile(parameters)).rejects.toThrow(
    'published dataset changed',
  );
});

it('rejects non-advancing pagination', async () => {
  fetchPage.mockResolvedValue(page([['A', 'P1']], true, 'same'));
  await expect(downloadLoomFile(parameters)).rejects.toThrow(
    'invalid export cursor',
  );
  expect(fetchPage).toHaveBeenCalledTimes(2);
});

it('passes cancellation through to the request and does not issue requests when already cancelled', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    downloadLoomFile(parameters, controller.signal),
  ).rejects.toThrow();
  expect(fetchPage).not.toHaveBeenCalled();
});

it('propagates authorization and transport failures', async () => {
  fetchPage.mockRejectedValue(new Error('Not authorized for this project'));
  await expect(downloadLoomFile(parameters)).rejects.toThrow('Not authorized');
});

it('carries active filters and project scope through every page', async () => {
  fetchPage
    .mockResolvedValueOnce(page([['A', 'P1']], true, 'next'))
    .mockResolvedValueOnce(page([]));
  await downloadLoomFile({
    ...parameters,
    filter: {
      mode: 'and',
      root: { diagnosis: { field: 'diagnosis', operator: '=', operand: 'A' } },
    },
  });
  for (const [request] of fetchPage.mock.calls) {
    expect(request.variables?.input).toMatchObject({
      projectId: 'HTAN_INT/BForePC',
      filters: [{ column: 'diagnosis', op: 'EQ', value: 'A' }],
    });
  }
});

it.each(['json', 'jsonl', 'tsv'] as const)(
  'encodes %s through the same scoped page reader',
  async (format) => {
    fetchPage.mockResolvedValueOnce(page([['A', 'P1']]));
    const blob = await downloadLoomFile({ ...parameters, format });
    const text = await blob.text();
    if (format === 'tsv')
      expect(text).toBe('Participant\tDiagnosis\r\nP1\tA\r\n');
    else if (format === 'json')
      expect(JSON.parse(text)).toEqual([{ identifier: 'P1', diagnosis: 'A' }]);
    else expect(text).toBe('{"identifier":"P1","diagnosis":"A"}\n');
  },
);

it('forwards typed sorting to every page', async () => {
  fetchPage.mockResolvedValueOnce(page([]));
  await downloadLoomFile({
    ...parameters,
    sort: { column: 'identifier', desc: true },
  });
  expect(fetchPage.mock.calls[0][0].variables?.input).toMatchObject({
    sort: { column: 'identifier', desc: true },
  });
});
