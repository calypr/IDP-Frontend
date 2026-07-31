import {
  RenderFactoryTypedInstance,
  DefaultItemRenderer,
} from '../../../utils/RendererFactory';
import React, { ReactNode } from 'react';
import { isArray } from 'lodash';
import { Badge, Text } from '@mantine/core';
import { CellRendererFunctionProps } from './types';

export interface CellRendererFunctionCatalogEntry {
  [key: string]: CellRendererFunction;
}

export type CellRendererFunction = (
  props: CellRendererFunctionProps,
  ...args: any[]
) => ReactNode;

// TanStack logs an error before throwing when getValue() names a column that
// is not present. Optional Explorer columns must be read without probing it.
export const getSafeRowValue = (
  row: CellRendererFunctionProps['row'],
  columnId: string,
): unknown => {
  const original = row.original as Record<string, unknown> | undefined;
  if (original && Object.prototype.hasOwnProperty.call(original, columnId)) {
    return original[columnId];
  }
  return row
    .getAllCells()
    .find((cell) => cell.column.id === columnId)
    ?.getValue();
};

// TODO need to type this
export const RenderArrayCell: CellRendererFunction = ({
  cell,
}: CellRendererFunctionProps) => {
  const value = cell.getValue();
  if (isArray(value)) {
    return (
      <div className="w-64 flex flex-wrap gap-0.5">
        {value.map((x, index) => (
          <Badge
            variant="outline"
            classNames={{ root: 'basis-1/3' }}
            color="accent-light"
            key={`${cell.id}-value-${index}`}
          >
            {x}
          </Badge>
        ))}
      </div>
    );
  }
  return <span>value</span>;
};

export const RenderArrayCellNegativePositive = ({
  cell,
}: CellRendererFunctionProps) => {
  const value = cell.getValue();
  if (isArray(value)) {
    return (
      <div className="w-64 flex flex-wrap gap-0.5">
        {value.map((x, index) => (
          <Badge
            variant="filled"
            color={x === 'Positive' ? 'green' : 'gray'}
            classNames={{ root: 'basis-1/3' }}
            key={`${cell.id}-value-${index}`}
          >
            {x}
          </Badge>
        ))}
      </div>
    );
  }
  return <span>value</span>;
};

export const ValueCellRenderer = ({ cell }: CellRendererFunctionProps) => {
  const value = cell.getValue();
  return (
    <span>
      {typeof value === 'boolean' ? String(value) : (value as ReactNode)}
    </span>
  );
};

const ArrayCellFunctionCatalog = {
  NegativePositive: RenderArrayCellNegativePositive,
  default: RenderArrayCell,
};

const RenderLinkCell = (
  { cell }: CellRendererFunctionProps,
  ...args: unknown[]
) => {
  const arg = args[0] as Record<string, unknown>;
  return (
    <a
      href={`${arg.baseURL}${cell.getValue()}`}
      target="_blank"
      rel="noreferrer"
    >
      <Text c="blue" td="underline" fw={700}>
        {' '}
        {cell.getValue() as ReactNode}{' '}
      </Text>
    </a>
  );
};

let instance: RenderFactoryTypedInstance<CellRendererFunctionProps>;

export const ExplorerTableCellRendererFactory =
  (): RenderFactoryTypedInstance<CellRendererFunctionProps> => {
    if (!instance) {
      instance = new RenderFactoryTypedInstance<CellRendererFunctionProps>();
    }
    return instance;
  };

export const RenderFileActions = (
  props: CellRendererFunctionProps,
  ...args: unknown[]
) => {
  const { cell, row } = props;
  const arg = (args[0] || {}) as Record<string, unknown>;
  let fileActionsConfig = arg.fileActions as
    | {
        extensions: Record<string, string[]>;
        actions: Record<string, string>;
      }
    | undefined;

  const fileActionsMap = arg.fileActionsMap as Record<string, any> | undefined;

  let projectId = '';
  const projectValue = getSafeRowValue(row, 'project_id');
  if (typeof projectValue === 'string') projectId = projectValue;

  if (
    !fileActionsConfig &&
    fileActionsMap &&
    projectId &&
    fileActionsMap[projectId]
  ) {
    fileActionsConfig = fileActionsMap[projectId];
  }

  let fileNameStr = '';
  const sourcePath = getSafeRowValue(row, 'document_reference_source_path');
  if (typeof sourcePath === 'string') fileNameStr = sourcePath;

  if (!fileNameStr) {
    const attachmentUrl = getSafeRowValue(
      row,
      'document_reference_content_attachment_url',
    );
    if (typeof attachmentUrl === 'string') fileNameStr = attachmentUrl;
  }

  if (!fileNameStr) {
    const attachmentTitle = getSafeRowValue(
      row,
      'document_reference_content_attachment_title',
    );
    if (typeof attachmentTitle === 'string') fileNameStr = attachmentTitle;
  }

  if (!fileNameStr) {
    const fileName = getSafeRowValue(row, 'file_name');
    if (typeof fileName === 'string') fileNameStr = fileName;
  }

  if (!fileNameStr) {
    const cellRef = cell.getValue();
    fileNameStr = typeof cellRef === 'string' ? cellRef : '';
  }

  const extension = fileNameStr.includes('.')
    ? fileNameStr.split('.').pop()?.toLowerCase() || ''
    : '';
  const actionsList =
    fileActionsConfig?.extensions?.[extension] ||
    fileActionsConfig?.extensions?.['default'] ||
    (arg.imageURL && ['tif', 'tiff'].includes(extension)
      ? ['file_download', 'file_image']
      : ['file_download']);

  if (actionsList.length === 0) return <React.Fragment />;

  return (
    <div className="flex space-x-2">
      {actionsList.map((actionName, index) => {
        const factory = ExplorerTableCellRendererFactory();
        let actionRenderer: CellRendererFunction | undefined;

        if (factory.rendererExists('link', actionName)) {
          actionRenderer = factory.getRenderer('link', actionName);
        } else if (factory.rendererExists('string', actionName)) {
          actionRenderer = factory.getRenderer('string', actionName);
        } else if (factory.rendererExists('value', actionName)) {
          actionRenderer = factory.getRenderer('value', actionName);
        }

        if (actionRenderer && actionRenderer !== DefaultItemRenderer) {
          const actionUrl = fileActionsConfig?.actions?.[actionName];
          return (
            <React.Fragment key={`${actionName}-${index}`}>
              {actionRenderer(props, { ...arg, actionUrl }, ...args.slice(1))}
            </React.Fragment>
          );
        }
        return null;
      })}
    </div>
  );
};

const LinkCellFunctionCatalog = {
  default: RenderLinkCell,
};

// register default cell renderers
export const registerExplorerDefaultCellRenderers = () => {
  ExplorerTableCellRendererFactory().registerRendererCatalog({
    value: {
      default: ValueCellRenderer,
    },
    array: ArrayCellFunctionCatalog,
    link: LinkCellFunctionCatalog,
    string: {
      fileActions: RenderFileActions,
      default: ValueCellRenderer,
    },
  });
};
