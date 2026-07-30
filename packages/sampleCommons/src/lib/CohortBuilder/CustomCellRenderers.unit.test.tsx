import type { CellRendererFunctionProps } from '@gen3/frontend';
import { RenderHumanReadableString } from './CustomCellRenderers';

jest.mock('@gen3/frontend', () => ({}));
jest.mock('@gen3/core', () => ({ SYFON_API: '' }));

it.each([
  ['1048576', '1.00 MB'],
  ['0', '0 B'],
])('formats Int64 JSON string %s', (value, expected) => {
  expect(
    RenderHumanReadableString({
      cell: { getValue: () => value },
    } as CellRendererFunctionProps),
  ).toBe(expected);
});
