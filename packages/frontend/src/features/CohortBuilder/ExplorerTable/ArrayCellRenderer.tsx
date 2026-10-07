import React from 'react';
import { isArray } from 'lodash';
import { CellRendererFunction } from './ExplorerTableCellRenderers';
import { JSONObject } from '@gen3/core';
import { CellRendererFunctionProps } from './types';

export const ArrayCellRenderer = (
  cellRenderFunction: CellRendererFunction,
  props: CellRendererFunctionProps<JSONObject>,
  ...args: any[]
) => {
  const { cell } = props;
  const value = cell.getValue();
  if (isArray(value)) {
    return (
      <div className="w-64 flex flex-wrap gap-0.5">
        {value.map((x, index) => {
          // Preserve the MRT cell metadata while making the item the value
          // returned by getValue(). This keeps custom renderers safe for
          // arrays containing objects as well as scalar values.
          const itemCell = {
            ...cell,
            getValue: () => x,
          } as typeof cell;
          return (
            <React.Fragment key={`${cell.id}-value-${index}`}>
              {cellRenderFunction({ ...props, cell: itemCell }, args)}
            </React.Fragment>
          );
        })}
      </div>
    );
  } else {
    return cellRenderFunction(props, args);
  }
};
