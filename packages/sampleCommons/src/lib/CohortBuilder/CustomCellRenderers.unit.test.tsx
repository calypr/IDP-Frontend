import React from 'react';
import { MantineProvider } from '@mantine/core';
import { render } from '@testing-library/react';
import type { CellRendererFunctionProps } from '@gen3/frontend';
import {
  RenderFileImageLink,
  RenderHumanReadableString,
} from './CustomCellRenderers';

jest.mock('@gen3/frontend', () => ({
  getSafeRowValue: jest.fn((row, field) => row.original[field]),
}));
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

it('uses the row sha256 for image-viewer actions instead of the cell UUID', () => {
  const { getByRole } = render(
    <MantineProvider>
      {RenderFileImageLink(
        {
          cell: { getValue: () => 'old-file-uuid' },
          row: { original: { sha256: 'sha256-value' } },
        } as CellRendererFunctionProps,
        { actionUrl: '/image-viewer/view' },
      )}
    </MantineProvider>,
  );

  expect(getByRole('link')).toHaveAttribute(
    'href',
    '/image-viewer/view/sha256-value',
  );
});

it('does not render an invalid image-viewer link when sha256 is absent', () => {
  const { queryByRole } = render(
    <MantineProvider>
      {RenderFileImageLink(
        {
          cell: { getValue: () => 'old-file-uuid' },
          row: { original: {} },
        } as CellRendererFunctionProps,
        { actionUrl: '/image-viewer/view' },
      )}
    </MantineProvider>,
  );

  expect(queryByRole('link')).not.toBeInTheDocument();
});
