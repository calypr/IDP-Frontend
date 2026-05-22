import { normalizeGeckoProjectRecord } from './geckoApi';

describe('normalizeGeckoProjectRecord', () => {
  it('normalizes slash-delimited org/project identifiers', () => {
    expect(normalizeGeckoProjectRecord('HTAN_INT/BForePC')).toEqual({
      resourcePath: '/organization/HTAN_INT/project/BForePC',
    });
  });

  it('normalizes git repository URLs into organization/project resource paths', () => {
    expect(
      normalizeGeckoProjectRecord(
        'https://github.com/EllrottLab/embedding-rotation.git',
      ),
    ).toEqual({
      resourcePath: '/organization/EllrottLab/project/embedding-rotation',
    });
  });

  it('preserves already-normalized resource paths', () => {
    expect(
      normalizeGeckoProjectRecord(
        '/organization/gdc_mirror/project/gdc_mirror',
      ),
    ).toEqual({
      resourcePath: '/organization/gdc_mirror/project/gdc_mirror',
    });
  });
});
