import React from 'react';
import { FacetDefinition, FacetType } from '@gen3/core';
import { createFacetCard } from '../../components/facets/createFacetCard';
import { FacetDataHooks } from '../../components/facets/types';

interface FiltersPanelProps {
  dataFunctions: Record<FacetType, FacetDataHooks>;
  fields: ReadonlyArray<FacetDefinition>;
  valueLabel: string;
}

export const FiltersPanel = ({
  fields,
  dataFunctions,
  valueLabel,
}: FiltersPanelProps): JSX.Element => {
  return (
    <div
      data-testid="filters-facets"
      className="flex flex-col gap-y-4 h-full overflow-y-scroll px-4 pb-2 w-full"
    >
      {fields.map((facetDefinition) => {
        return createFacetCard({
          facetDefinition,
          valueLabel,
          hooks: dataFunctions[facetDefinition.type],
          facetNameFormatter: (field) => facetDefinition.label ?? field,
          idPrefix: 'filters-panel',
          hideIfEmpty: false,
          width: 'w-64',
          showPercent: false,
        });
      })}
    </div>
  );
};
