import { Text, Tooltip } from '@mantine/core';
import React from 'react';
import { DataItemRendererFunction, DataItemRenderFunctionProps } from './types';
import { isTextTransform } from '../../utils';
import { renderCell } from '../../utils/renderCell';

export const TruncatedStringWithTooltip: DataItemRendererFunction = ({
  value,
  params,
}: DataItemRenderFunctionProps) => {
  let limit = 15;
  if (
    typeof params?.maxLength === 'string' &&
    !isNaN(Number(params?.maxLength))
  ) {
    limit = parseInt(params?.maxLength, 10);
  } else if (typeof params?.maxLength === 'number') {
    limit = params?.maxLength;
  }

  const ttValue = isTextTransform(params?.transform)
    ? params?.transform
    : undefined;
  const valueIfNotAvailable = params?.valueIfNotAvailable ?? '';
  const content = renderCell(value);

  if (content === '') {
    return <Text>{`${valueIfNotAvailable}`}</Text>;
  }

  const truncated =
    content.length > limit ? `${content.slice(0, limit)}...` : content;
  return (
    <Tooltip label={content}>
      <Text tt={ttValue}>{truncated}</Text>
    </Tooltip>
  );
};
