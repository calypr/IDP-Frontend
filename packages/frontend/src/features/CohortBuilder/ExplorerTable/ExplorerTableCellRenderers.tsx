import {
  CellRendererFunctionProps,
  RenderFactoryTypedInstance,
} from '../../../utils/RendererFactory';
import React, { ReactElement, useState } from 'react';
import { isArray } from 'lodash';
import { Badge, Text, Modal, Button, Alert } from '@mantine/core';
import saveAs from 'file-saver';
import { DiscoveryCellRendererFactory } from '../../Discovery';
import { Gen3DiscoveryStandardCellRenderers } from '../../Discovery/TableRenderers/CellRenderers';

export interface CellRendererFunctionCatalogEntry {
  [key: string]: CellRendererFunction;
}

export type CellRendererFunction = (
  props: CellRendererFunctionProps,
  ...args: any[]
) => ReactElement;
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
  return <span>{cell.getValue() as ReactElement}</span>;
};

const ArrayCellFunctionCatalog = {
  NegativePositive: RenderArrayCellNegativePositive,
  default: RenderArrayCell,
};

const RenderLinkCell = (
  { cell }: CellRendererFunctionProps,
  ...args: Array<Record<string, unknown>>
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (args.length > 0 && args[0].baseURL) {
      const signedUrl = `${args[0].baseURL}${cell.getValue()}`;
      const response = await fetch(signedUrl);

      if (!response.ok) {
        setError(
          `Failed to download file ${response.status}:${response.statusText}`,
        );
        setIsOpen(true);
      }
      const data = await response.json();
      saveAs(data.url, `${cell.getValue()}`);
    } else if (args.length > 0 && args[0].modal_viewer === true) {
      <Alert variant="error" icon={<Text>!</Text>}>
        HELLO WE ARE HERE
      </Alert>;
    }
  };

  return (
    <>
      <a onClick={handleClick}>
        <Text c="blue" td="underline" fw={700}>
          {' '}
          {cell.getValue() as ReactElement}{' '}
        </Text>
      </a>
      <Modal opened={isOpen} onClose={() => setIsOpen(false)}>
        <Alert variant="error" icon={<Text>!</Text>}>
          {error}
        </Alert>
      </Modal>
    </>
  );
};

const LinkCellFunctionCatalog = {
  default: RenderLinkCell,
};

let instance: RenderFactoryTypedInstance<CellRendererFunctionProps>;

export const ExplorerTableCellRendererFactory =
  (): RenderFactoryTypedInstance<CellRendererFunctionProps> => {
    if (!instance) {
      instance = new RenderFactoryTypedInstance<CellRendererFunctionProps>();
    }
    return instance;
  };

// register default cell renderers
export const registerExplorerDefaultCellRenderers = () => {
  ExplorerTableCellRendererFactory().registerRendererCatalog({
    value: {
      default: ValueCellRenderer,
    },
  });
  ExplorerTableCellRendererFactory().registerRendererCatalog({
    array: ArrayCellFunctionCatalog,
  });
  ExplorerTableCellRendererFactory().registerRendererCatalog({
    link: LinkCellFunctionCatalog,
  });
};
