import {
  ExplorerTableCellRendererFactory,
  type CellRendererFunctionProps,
} from '@gen3/frontend';
import { ActionIcon, Text } from '@mantine/core';
import React from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { labelEnd } from 'micromark-core-commonmark';

const RenderDiacomLink = (
  { cell, row }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  if (
    !cell?.getValue() ||
    cell?.getValue() === '' ||
    (!(row.getValue('source_path') as string).endsWith('.tiff') &&
      !(row.getValue('source_path') as string).endsWith('.tif'))
  ) {
    return <span></span>;
  } else
    return (
      <a
        href={`${args[0].baseURL}/${cell.getValue()}`}
        target="_blank"
        rel="noreferrer"
      >
        <ActionIcon color="accent.5" size="md" variant="filled">
          <FaExternalLinkAlt />
        </ActionIcon>
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
  const bytes = row.getValue('size') as number;
  if (bytes === 0) return '0 B';
  const humanReadable = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const round = bytes / Math.pow(1024, i);
  return `${round.toFixed(2)} ${humanReadable[i]}`;
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

export const registerCohortTableCustomCellRenderers = () => {
  ExplorerTableCellRendererFactory().registerRenderer(
    'link',
    'DiacomLink',
    RenderDiacomLink,
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
