import { Paper, LoadingOverlay, Text } from '@mantine/core';

interface CountsValueProps {
  readonly label: string;
  readonly counts?: number;
  readonly isSuccess: boolean;
}

const CountsValue = ({ label, isSuccess, counts }: CountsValueProps) => {
  const pluralizedLabel = Number(counts) == 1
    ? label.slice(0, -1)
    : label;

  return (
    <div className="mr-4">
      <LoadingOverlay visible={!isSuccess} />
      <Text className="rounded mr-4" color="text-base-contrast">
        {`${counts?.toLocaleString() ?? '...'} ${pluralizedLabel}`}
      </Text>
    </div>
  );
};

export default CountsValue;
