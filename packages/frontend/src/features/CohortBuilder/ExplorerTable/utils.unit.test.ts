jest.mock('@gen3/core', () => ({ fieldNameToTitle: jest.fn() }));

import { includeAvailableSha256, publicLoomFields } from './utils';

describe('includeAvailableSha256', () => {
  it('requests sha256 when Loom exposes it without adding a visible table field', () => {
    expect(
      includeAvailableSha256(
        ['id', 'title'],
        [{ name: 'id' }, { name: 'title' }, { name: 'sha256' }],
      ),
    ).toEqual(['id', 'title', 'sha256']);
  });

  it('does not request sha256 when the Loom dataset does not expose it', () => {
    expect(
      includeAvailableSha256(['id', 'title'], [
        { name: 'id' },
        { name: 'title' },
      ]),
    ).toEqual(['id', 'title']);
  });

  it('does not duplicate a configured sha256 field', () => {
    expect(
      includeAvailableSha256(['id', 'sha256'], [
        { name: 'id' },
        { name: 'sha256' },
      ]),
    ).toEqual(['id', 'sha256']);
  });
});

describe('publicLoomFields', () => {
  it('does not expose Loom authorization or pagination columns', () => {
    expect(
      publicLoomFields(['id', 'auth_resource_path', '__loom_row_id', 'title']),
    ).toEqual(['id', 'title']);
  });
});
