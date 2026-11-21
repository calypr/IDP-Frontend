import React, { useState, useEffect, useId, useRef } from 'react';
import { Modals, showModal, useCoreDispatch } from '@gen3/core';
import { GuppyActionButtonProps } from '../../features/CohortBuilder/types';
import {
  hideNotification as dismissNotification,
  showNotification,
} from '@mantine/notifications';
import { DownloadNotification } from '../../utils/download';
import { Loader } from '@mantine/core';
import { FiDownload } from 'react-icons/fi';
import { useDeepCompareCallback } from 'use-deep-compare';

interface DownloadActionHookProps extends Pick<
  GuppyActionButtonProps,
  | 'Modal403'
  | 'Modal400'
  | 'done'
  | 'customErrorMessage'
  | 'hideNotification'
  | 'actionFunction'
  | 'actionArgs'
> {
  setIsActive?: (active: boolean) => void;
}

const useDownloadAction = ({
  Modal403 = Modals.NoAccessModal,
  Modal400 = Modals.GeneralErrorModal,
  done,
  customErrorMessage,
  hideNotification = false,
  actionFunction,
  actionArgs,
  setIsActive = (_: boolean) => null,
}: DownloadActionHookProps) => {
  const [active, setActive] = useState(false);
  const dispatch = useCoreDispatch();

  const handleError = useDeepCompareCallback(
    (error: Error) => {
      const errorMessage: string = error.message;
      if (
        errorMessage === 'internal server error' ||
        errorMessage === undefined
      ) {
        dispatch(showModal({ modal: Modal400, message: errorMessage }));
      } else if (
        errorMessage ===
        'Your token is invalid or expired. Please get a new token.'
      ) {
        dispatch(showModal({ modal: Modal403, message: errorMessage }));
      } else {
        dispatch(
          showModal({
            modal: Modal400,
            message: customErrorMessage || errorMessage,
          }),
        );
      }
    },
    [Modal400, Modal403, customErrorMessage, dispatch],
  );

  const notificationId = useId();
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      const controller = activeRequest.current;
      activeRequest.current = null;
      controller?.abort();
      dismissNotification(notificationId);
    },
    [notificationId],
  );

  const handleClick = async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setActive(true);
    setIsActive(true);
    if (!hideNotification)
      showNotification({
        id: notificationId,
        message: <DownloadNotification onClick={() => controller.abort()} />,
        autoClose: false,
        withCloseButton: false,
      });
    const isCurrent = () => activeRequest.current === controller;
    try {
      await actionFunction(
        actionArgs,
        () => {
          if (isCurrent() && !controller.signal.aborted) done?.();
        },
        (error) => {
          if (isCurrent() && !controller.signal.aborted) handleError(error);
        },
        () => undefined,
        controller.signal,
      );
    } catch (error: unknown) {
      if (isCurrent() && !controller.signal.aborted)
        handleError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (isCurrent()) {
        activeRequest.current = null;
        dismissNotification(notificationId);
        setActive(false);
        setIsActive(false);
      }
    }
  };

  const icon = active ? (
    <Loader size="sm" className="p-1" />
  ) : (
    <FiDownload title="download" size={16} />
  );

  return {
    handleClick,
    icon,
    active,
  };
};

export default useDownloadAction;
