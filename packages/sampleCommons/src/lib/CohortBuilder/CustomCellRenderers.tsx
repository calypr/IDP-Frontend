import React, { ReactNode } from 'react';
import {
  ExplorerTableCellRendererFactory,
  type CellRendererFunctionProps,
} from '@gen3/frontend';
import { ActionIcon, Text } from '@mantine/core';
import { FaExternalLinkAlt } from 'react-icons/fa';

const RenderReportsLink = (
  { cell, row }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  return (
    <a
      href={`${args[0].baseURL}/${cell.getValue()}`}
      target="_blank"
      rel="noreferrer"
    >
      <ActionIcon color="primary.0" size="md" variant="filled">
        <FaExternalLinkAlt />
      </ActionIcon>
    </a>
  );
};

const RenderDicomLink = (
  { cell, row }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  if (
    !cell?.getValue() ||
    cell?.getValue() === '' ||
    (!(row.getValue('source_path') as string)?.endsWith('.tiff') &&
      !(row.getValue('source_path') as string)?.endsWith('.tif'))
  ) {
    return <span></span>;
  } else
    return (
      <a
        href={`${args[0].baseURL}/${cell.getValue()}`}
        target="_blank"
        rel="noreferrer"
      >
        <ActionIcon color="primary.0" size="md" variant="filled">
          <FaExternalLinkAlt />
        </ActionIcon>
      </a>
    );
};

const JoinFields = (
  { cell, row }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  if (!cell?.getValue() || cell?.getValue() === '') {
    return <span></span>;
  } else {
    if (
      typeof args[0] === 'object' &&
      Object.keys(args[0]).includes('otherFields')
    ) {
      const otherFields = args[0].otherFields as Array<string>;
      const labels = otherFields.map((field) => {
        return row.getValue(field);
      });
      return <Text fw={600}> {labels.join(' ')}</Text>;
    }
  }
  return <span>Not configured</span>;
};

const RenderLinkCell = ({ cell }: CellRendererFunctionProps) => {
  return (
    <a href={`${cell.getValue()}`} target="_blank" rel="noreferrer">
      <Text c="blue" td="underline" fw={700}>
        {' '}
        {cell.getValue() as ReactNode}{' '}
      </Text>
    </a>
  );
};

const RenderHumanReadableString = (
  { cell, row }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  if (!cell?.getValue() || cell?.getValue() === '') {
    return <span></span>;
  }
  const bytes = Number(row.getValue('size'));
  if (bytes === 0) return '0 B';
  const humanReadable = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const round = bytes / Math.pow(1024, i);
  return `${round.toFixed(2)} ${humanReadable[i]}`;
};

export const registerCohortTableCustomCellRenderers = () => {
  ExplorerTableCellRendererFactory().registerRenderer(
    'link',
    'ReportsLink',
    RenderReportsLink,
  );
  ExplorerTableCellRendererFactory().registerRenderer(
    'link',
    'DicomLink',
    RenderDicomLink,
  );
  ExplorerTableCellRendererFactory().registerRenderer(
    'string',
    'JoinFields',
    JoinFields,
  );
  ExplorerTableCellRendererFactory().registerRenderer(
    'link',
    'linkURL',
    RenderLinkCell,
  );
  ExplorerTableCellRendererFactory().registerRenderer(
    'string',
    'HumanReadableString',
    RenderHumanReadableString,
  );
  ExplorerTableCellRendererFactory().registerRenderer(
    'string',
    'JoinFields',
    JoinFields,
  );
};
