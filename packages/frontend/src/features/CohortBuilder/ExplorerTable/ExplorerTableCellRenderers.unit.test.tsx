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

it('renders structured FHIR values without passing objects to React', () => {
  const { getByText } = render(
    <ValueCellRenderer
      {...({
        cell: {
          getValue: () => ({
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '123',
                display: 'Example diagnosis',
              },
            ],
          }),
        },
      } as CellRendererFunctionProps)}
    />,
  );

  expect(getByText('Example diagnosis')).toBeInTheDocument();
});

it('renders the legacy image action for TIFF files', () => {
  const factory = ExplorerTableCellRendererFactory();
  factory.registerRenderer('link', 'file_download', () => (
    <span>download</span>
  ));
  factory.registerRenderer('link', 'file_image', () => <span>image</span>);

  const props = {
    cell: { getValue: () => '2cb17d5c-cccd-5936-babf-5e7ec638f742' },
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

it('does not render actions when only an object path is available', () => {
  const props = {
    cell: { getValue: () => 's3://bucket/file.bam' },
    row: {
      original: {
        document_reference_source_path: 's3://bucket/file.bam',
      },
      getAllCells: () => [],
    },
  } as unknown as CellRendererFunctionProps;
  const { queryByText } = render(
    <>{RenderFileActions(props, { fileActions: { actions: { file_download: '/download' }, extensions: { default: ['file_download'] } } })}</>,
  );

  expect(queryByText('download')).not.toBeInTheDocument();
});

it('uses a UUID for custom actions and never passes an object path as the file id', () => {
  const factory = ExplorerTableCellRendererFactory();
  factory.registerRenderer('link', 'file_download_uuid_test', ({ cell }, ...args) => (
    <span>{`${(args[0] as Record<string, unknown>).fileId}:${cell.getValue()}`}</span>
  ));

  const uuid = '2cb17d5c-cccd-5936-babf-5e7ec638f742';
  const props = {
    cell: { getValue: () => 's3://bucket/file.bam' },
    row: {
      original: {
        id: uuid,
        document_reference_source_path: 's3://bucket/file.bam',
      },
      getAllCells: () => [],
    },
  } as unknown as CellRendererFunctionProps;
  const { getByText } = render(
    <>{RenderFileActions(props, { fileActions: { actions: { file_download_uuid_test: '/download' }, extensions: { default: ['file_download_uuid_test'] } } })}</>,
  );

  expect(getByText(`${uuid}:${uuid}`)).toBeInTheDocument();
});

it('renders a fallback action link when no custom action renderer is registered', () => {
  const uuid = '2cb17d5c-cccd-5936-babf-5e7ec638f742';
  const props = {
    cell: { getValue: () => uuid },
    row: {
      original: { id: uuid },
      getAllCells: () => [],
    },
  } as unknown as CellRendererFunctionProps;
  const { getByRole } = render(
    <>
      {RenderFileActions(props, {
        fileActions: {
          actions: { custom_download: '/download' },
          extensions: { default: ['custom_download'] },
        },
      })}
    </>,
  );

  expect(getByRole('link', { name: 'custom_download' })).toHaveAttribute(
    'href',
    `/download/${uuid}`,
  );
  expect(getByRole('link', { name: 'custom_download' })).toHaveClass(
    'bg-primary',
  );
});
