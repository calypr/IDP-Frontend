import {
  RenderFactoryTypedInstance,
  DefaultItemRenderer,
} from '../../../utils/RendererFactory';
import React, { ReactNode } from 'react';
import { isArray } from 'lodash';
import { Badge, Text } from '@mantine/core';
import { FaFileDownload, FaImage } from 'react-icons/fa';
import { CellRendererFunctionProps } from './types';
import { renderCell } from '../../../utils/renderCell';

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
            {renderCell(x)}
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
            {renderCell(x)}
          </Badge>
        ))}
      </div>
    );
  }
  return <span>value</span>;
};

export const ValueCellRenderer = ({ cell }: CellRendererFunctionProps) => {
  const value = cell.getValue();
  return <span>{renderCell(value)}</span>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value.trim());

const fileIdentifierFor = (
  cell: CellRendererFunctionProps['cell'],
  row: CellRendererFunctionProps['row'],
): string | undefined => {
  const candidates = [
    cell.getValue(),
    getSafeRowValue(row, 'id'),
    getSafeRowValue(row, 'file_id'),
    getSafeRowValue(row, 'file_uuid'),
    getSafeRowValue(row, 'document_reference_id'),
    getSafeRowValue(row, 'document_reference_identifier'),
    getSafeRowValue(row, 'uuid'),
    getSafeRowValue(row, 'sha256'),
  ];
  return candidates.find(isUuid);
};

const renderDefaultFileAction = (
  actionName: string,
  actionUrl: string | undefined,
  fileId: string,
) => {
  const baseUrl = (
    actionUrl ||
    (actionName === 'file_download'
      ? '/download'
      : actionName === 'file_image'
        ? '/image-viewer/view'
        : '')
  ).replace(/\/+$/, '');
  if (!baseUrl) return null;
  const href = `${baseUrl}/${encodeURIComponent(fileId)}${
    actionName === 'file_download'
      ? `${baseUrl.includes('?') ? '&' : '?'}redirect=true`
      : ''
  }`;
  const icon =
    actionName === 'file_download' ? (
      <FaFileDownload aria-hidden="true" />
    ) : actionName === 'file_image' ? (
      <FaImage aria-hidden="true" />
    ) : null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={actionName}
      title={actionName}
      className="inline-flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-contrast text-xs font-semibold"
    >
      {icon || actionName}
    </a>
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
  const content = renderCell(cell.getValue());
  return (
    <a
      href={`${arg.baseURL}${content}`}
      target="_blank"
      rel="noreferrer"
    >
      <Text c="blue" td="underline" fw={700}>
        {' '}{content}{' '}
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
  const fileId = fileIdentifierFor(cell, row);
  if (!fileId) return <React.Fragment />;
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

  const fileNameWithoutQuery = fileNameStr.split(/[?#]/, 1)[0];
  const extension = fileNameWithoutQuery.includes('.')
    ? fileNameWithoutQuery.split('.').pop()?.toLowerCase() || ''
    : '';
  const configuredActions = [
    fileActionsConfig?.extensions?.[extension],
    fileActionsConfig?.extensions?.[`.${extension}`],
    fileActionsConfig?.extensions?.['default'],
  ].find((actions): actions is string[] => Array.isArray(actions));
  const actionsList =
    configuredActions ||
    (arg.imageURL && ['tif', 'tiff'].includes(extension)
      ? ['file_download', 'file_image']
      : ['file_download']);

  if (actionsList.length === 0) return <React.Fragment />;

  // Action renderers historically read cell.getValue() directly. Replace
  // that value for the action call so a source path can never leak through
  // as a file identifier when the action column is not the UUID column.
  const actionProps = {
    ...props,
    cell: Object.assign(Object.create(cell), {
      getValue: () => fileId,
    }),
  } as CellRendererFunctionProps;

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
              {actionRenderer(
                actionProps,
                { ...arg, actionUrl, fileId },
                ...args.slice(1),
              )}
            </React.Fragment>
          );
        }
        const actionUrl = fileActionsConfig?.actions?.[actionName];
        const fallback = renderDefaultFileAction(actionName, actionUrl, fileId);
        return fallback ? (
          <React.Fragment key={`${actionName}-${index}`}>
            {fallback}
          </React.Fragment>
        ) : null;
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

// The table can be mounted by a direct frontend consumer without the sample
// app's _app registration hook. Keep the built-in renderers available in that
// case as well; application-specific action renderers can still be layered on.
registerExplorerDefaultCellRenderers();
