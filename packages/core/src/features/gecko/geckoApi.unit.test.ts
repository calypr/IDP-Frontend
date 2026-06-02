import { normalizeGeckoProjectRecord } from './geckoApi';

describe('normalizeGeckoProjectRecord', () => {
  it('normalizes slash-delimited org/project identifiers', () => {
    expect(normalizeGeckoProjectRecord('HTAN_INT/BForePC')).toEqual({
      resourcePath: '/programs/HTAN_INT/projects/BForePC',
    });
  });

  it('normalizes git repository URLs into organization/project resource paths', () => {
    expect(
      normalizeGeckoProjectRecord(
        'https://github.com/EllrottLab/embedding-rotation.git',
      ),
    ).toEqual({
      resourcePath: '/programs/EllrottLab/projects/embedding-rotation',
    });
  });

  it('preserves already-normalized resource paths', () => {
    expect(
      normalizeGeckoProjectRecord(
        '/programs/gdc_mirror/projects/gdc_mirror',
      ),
    ).toEqual({
      resourcePath: '/programs/gdc_mirror/projects/gdc_mirror',
    });
  });
});
