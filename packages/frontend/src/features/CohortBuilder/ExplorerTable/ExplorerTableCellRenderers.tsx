import { RenderFactoryTypedInstance, DefaultItemRenderer } from '../../../utils/RendererFactory';
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

const ValueCellRenderer = ({ cell }: CellRendererFunctionProps) => {
  return <span>{cell.getValue() as ReactNode}</span>;
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
  const arg = args[0] as Record<string, unknown>;
  // Attempt to read fileActions from the passed args. If not present directly, we might need a context or it's passed down from root.
  // For now, let's assume it gets passed down in the args (we will update ExplorerTable next if needed).
  const fileActionsConfig = arg.fileActions as Record<string, string[]> | undefined;

  const fileName = cell.getValue();
  const fileNameStr = typeof fileName === 'string' ? fileName : '';

  // Get extension from filename
  const extension = fileNameStr.includes('.') ? fileNameStr.split('.').pop()?.toLowerCase() || '' : '';

  // Get actions for this extension
  const actions = fileActionsConfig?.[extension] || ['file_download'];

  if (actions.length === 0) return <React.Fragment />;

  return (
    <div className="flex space-x-2">
      {actions.map((actionName, index) => {
        // Look up the action in all possible catalogs in the main factory
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
          return (
            <React.Fragment key={`${actionName}-${index}`}>
              {actionRenderer(props, ...args)}
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
