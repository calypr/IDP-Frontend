import React from 'react';
import { render } from '@testing-library/react';
import {
  ExplorerTableCellRendererFactory,
  RenderFileActions,
  ValueCellRenderer,
} from './ExplorerTableCellRenderers';
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

it('renders the legacy image action for TIFF files', () => {
  const factory = ExplorerTableCellRendererFactory();
  factory.registerRenderer('link', 'file_download', () => (
    <span>download</span>
  ));
  factory.registerRenderer('link', 'file_image', () => <span>image</span>);

  const props = {
    cell: { getValue: () => 'file-id' },
    row: {
      original: {
        document_reference_content_attachment_url: 'file:///slide.ome.tiff',
      },
      getAllCells: () => [],
    },
  } as unknown as CellRendererFunctionProps;
  const { getByText } = render(
    <>{RenderFileActions(props, { imageURL: '/image-viewer/view' })}</>,
  );

  expect(getByText('download')).toBeInTheDocument();
  expect(getByText('image')).toBeInTheDocument();
});
