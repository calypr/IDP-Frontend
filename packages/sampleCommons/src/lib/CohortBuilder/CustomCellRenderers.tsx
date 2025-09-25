import React, { ReactNode } from 'react';
import {
  ExplorerTableCellRendererFactory,
  type CellRendererFunctionProps,
} from '@gen3/frontend';
import { ActionIcon, Text } from '@mantine/core';
import { FaExternalLinkAlt, FaImage, FaFileDownload } from 'react-icons/fa';

/* Used for research_subject, medication_administration, and specimen indices */
const RenderReportsLink = (
  { cell, row }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  const cellValue = cell?.getValue();
  const projectId = row.getValue('project_id') as string;
  const baseUrl = args[0]?.baseURL;
  if (
    cellValue &&
    cellValue !== '' &&
    // since this only designed for 1 project
    // might as well hardcode it into the renderer for now
    projectId === 'cbds-smmart_labkey_demo' &&
    baseUrl
  ) {
    return (
      <a href={`${baseUrl}/${cellValue}`} target="_blank" rel="noreferrer">
        <ActionIcon color="primary.0" size="md" variant="filled">
          <FaExternalLinkAlt />
        </ActionIcon>
      </a>
    );
  }

  // If any condition fails, return an empty span to render nothing
  return <span></span>;
};

/* Used for document_reference indices */
const RenderDicomLink = (
  { cell, row }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  if (
    !cell?.getValue() ||
    cell?.getValue() === '' ||
    (!(row.getValue('document_reference_source_path') as string)?.endsWith(
      '.tiff',
    ) &&
      !(row.getValue('document_reference_source_path') as string)?.endsWith(
        '.tif',
      ))
  ) {
    return (
      <a
        href={`${args[0]?.downloadURL}/${cell.getValue()}?redirect=true`}
        rel="noreferrer"
        target="_blank"
      >
        <ActionIcon color="primary.0" size="md" variant="filled">
          <FaFileDownload />
        </ActionIcon>
      </a>
    );
  } else
    return (
      <div className="flex space-x-2">
        <a
          href={`${args[0]?.downloadURL}/${cell.getValue()}?redirect=true`}
          rel="noreferrer"
          target="_blank"
        >
          <ActionIcon color="primary.0" size="md" variant="filled">
            <FaFileDownload />
          </ActionIcon>
        </a>
        <a
          href={`${args[0]?.imageURL}/${cell.getValue()}`}
          target="_blank"
          rel="noreferrer"
        >
          <ActionIcon color="primary.0" size="md" variant="filled">
            <FaImage />
          </ActionIcon>
        </a>
      </div>
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
  const bytes = Number(row.getValue('document_reference_size'));
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
