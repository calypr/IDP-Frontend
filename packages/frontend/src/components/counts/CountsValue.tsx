import React from 'react';
import { LoadingOverlay, Text } from '@mantine/core';

interface CountsValueProps {
  readonly label: string;
  readonly counts?: number;
  readonly isFetching: boolean;
  readonly isError: boolean;
}

const CountsValue = ({
  label,
  isFetching,
  isError,
  counts,
}: CountsValueProps) => {
  const pluralizedLabel = Number(counts) == 1 ? label.slice(0, -1) : label;

  return (
    <div className="mr-4 relative">
      <LoadingOverlay visible={isFetching} />
      <Text className="rounded mr-4" color="text-base-contrast">
        {`${counts?.toLocaleString() ?? '...'} ${pluralizedLabel}`}
      </Text>
    </div>
  );
};

export default CountsValue;
