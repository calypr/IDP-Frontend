import { Button, LoadingOverlay, Text } from '@mantine/core';

import { FilterSet, useGetCountsQuery } from '@gen3/core';

import { Gen3Button } from '../Buttons/Gen3Button';

interface CountsValueProps {
  readonly label: string;
  readonly counts?: number;
  readonly isSuccess: boolean;
}

const CountsValue = ({ label, isSuccess, counts }: CountsValueProps) => {
  // TODO handle case of data.length == 1
  return (
    <div className="mr-4">
      <LoadingOverlay visible={!isSuccess} />
      <Text className="rounded mr-4" color="text-base-contrast">
        {`${counts?.toLocaleString() ?? '...'} ${label}`}
      </Text>
    </div>
  );
};

export default CountsValue;
