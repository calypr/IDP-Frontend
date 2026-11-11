import React from 'react';
import { NativeSelect } from '@mantine/core';

export const ExplorerToolbar = ({
  downloads,
  selection,
  controls,
}: {
  readonly downloads: React.ReactNode;
  readonly selection?: React.ReactNode;
  readonly controls: React.ReactNode;
}) => (
  <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-3 py-2 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)_minmax(0,1fr)]">
    <div className="min-w-0">{downloads}</div>
    {selection ? (
      <div className="min-w-0 flex-[1_1_22rem] border-t border-base-lighter pt-3 sm:border-0 sm:pt-0">
        {selection}
      </div>
    ) : (
      <div className="hidden 2xl:block" />
    )}
    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3">
      {controls}
    </div>
  </div>
);

export const ProjectConfigurationSelect = ({
  value,
  options,
  onChange,
}: {
  readonly value: string;
  readonly options: ReadonlyArray<{
    readonly value: string;
    readonly label: string;
  }>;
  readonly onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}) => (
  <label className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
    <span className="shrink-0 text-sm font-medium text-base-darkest">
      Project configuration
    </span>
    <NativeSelect
      aria-label="Project configuration"
      className="w-full min-w-0 sm:w-56 sm:shrink"
      size="sm"
      radius="md"
      value={value}
      title={options.find((option) => option.value === value)?.label}
      data={options.map((option) => ({ ...option }))}
      onChange={onChange}
      classNames={{
        input:
          'truncate font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      }}
    />
  </label>
);
