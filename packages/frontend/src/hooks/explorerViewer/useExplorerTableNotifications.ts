import { useEffect } from 'react';
import type { LoomTableRenderResponse } from '@gen3/core';

export const useExplorerTableNotifications = ({
  response,
  requestSignature,
  isFetching,
  isError,
  onResponse,
  onStateChange,
}: {
  readonly response?: LoomTableRenderResponse;
  readonly requestSignature?: string;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly onResponse?: (
    response: LoomTableRenderResponse,
    requestSignature?: string,
  ) => void;
  readonly onStateChange?: (state: {
    isFetching: boolean;
    isError: boolean;
  }) => void;
}) => {
  useEffect(() => {
    onStateChange?.({ isFetching, isError });
    if (response && !isFetching) onResponse?.(response, requestSignature);
  }, [
    isError,
    isFetching,
    onResponse,
    onStateChange,
    requestSignature,
    response,
  ]);
};
