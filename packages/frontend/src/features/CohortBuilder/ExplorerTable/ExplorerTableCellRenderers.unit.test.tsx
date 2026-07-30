import React from 'react';
import { render } from '@testing-library/react';
import { ValueCellRenderer } from './ExplorerTableCellRenderers';
import type { CellRendererFunctionProps } from './types';

it.each([true, false])('renders boolean cell value %s', (value) => {
  const { getByText } = render(
    <ValueCellRenderer
      {...({
        cell: { getValue: () => value },
      } as CellRendererFunctionProps)}
    />,
  );

  expect(getByText(String(value))).toBeInTheDocument();
});
