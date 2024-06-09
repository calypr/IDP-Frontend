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
      <Gen3Button
        className="px-2 py-1 rounded mr-4 text-black"
        colors="primary"
      >
        {`${counts?.toLocaleString() ?? '...'} ${label}`}
      </Gen3Button>
    </div>
  );
};

export default CountsValue;
