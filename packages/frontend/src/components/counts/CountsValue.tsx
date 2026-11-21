import React from 'react';
import { LoadingOverlay, Text } from '@mantine/core';
import pluralize from 'pluralize';

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
  const countLabel = label.trim() || 'records';
  const pluralizedLabel = pluralize(countLabel, counts === 1 ? 1 : 2);

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
