import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { hideNotification, showNotification } from '@mantine/notifications';
import useDownloadAction from '../../../hooks/explorerViewer/useDownloadAction';

const mockDispatch = jest.fn();
jest.mock('@gen3/core', () => ({
  Modals: { NoAccessModal: 'no-access', GeneralErrorModal: 'error' },
  showModal: (value: unknown) => value,
  useCoreDispatch: () => mockDispatch,
}));
jest.mock('@mantine/notifications', () => ({
  hideNotification: jest.fn(),
  showNotification: jest.fn(),
}));
jest.mock('../../../utils/download', () => ({
  DownloadNotification: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>Cancel</button>
  ),
}));

const pending = () => {
  let finish: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { promise, finish: () => finish() };
};
beforeEach(() => jest.clearAllMocks());

it('ignores duplicate clicks and dismisses only its own notification', async () => {
  const request = pending();
  const action = jest.fn(() => request.promise);
  const { result } = renderHook(() =>
    useDownloadAction({ actionFunction: action, actionArgs: {} }),
  );
  let running: Promise<void> | undefined;
  act(() => {
    running = result.current.handleClick();
  });
  await act(async () => {
    await result.current.handleClick();
  });
  expect(action).toHaveBeenCalledTimes(1);
  expect(result.current.active).toBe(true);
  await act(async () => {
    request.finish();
    await running;
  });
  expect(result.current.active).toBe(false);
  expect(hideNotification).toHaveBeenCalledWith(
    jest.mocked(showNotification).mock.calls[0][0].id,
  );
});

it('aborts on unmount and ignores late completion callbacks', async () => {
  const request = pending();
  let signal: AbortSignal | undefined;
  let complete: () => void = () => {};
  const done = jest.fn();
  const { result, unmount } = renderHook(() =>
    useDownloadAction({
      actionFunction: (_args, onDone, _error, _abort, requestSignal) => {
        signal = requestSignal;
        complete = () => {
          onDone?.();
        };
        return request.promise;
      },
      actionArgs: {},
      done,
    }),
  );
  let running: Promise<void> | undefined;
  act(() => {
    running = result.current.handleClick();
  });
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    complete();
    request.finish();
    await running;
  });
  expect(done).not.toHaveBeenCalled();
});

it('cancels only the owning download while another remains active', async () => {
  const first = pending();
  const second = pending();
  let firstSignal: AbortSignal | undefined;
  let secondSignal: AbortSignal | undefined;
  const { result } = renderHook(() => ({
    first: useDownloadAction({
      actionFunction: (_args, _done, _error, _abort, signal) => {
        firstSignal = signal;
        return first.promise;
      },
      actionArgs: {},
    }),
    second: useDownloadAction({
      actionFunction: (_args, _done, _error, _abort, signal) => {
        secondSignal = signal;
        return second.promise;
      },
      actionArgs: {},
    }),
  }));
  let a: Promise<void> | undefined;
  let b: Promise<void> | undefined;
  act(() => {
    a = result.current.first.handleClick();
    b = result.current.second.handleClick();
  });
  const notifications = jest.mocked(showNotification).mock.calls;
  expect(notifications[0][0].id).not.toBe(notifications[1][0].id);
  const message = notifications[0][0].message;
  if (!React.isValidElement<{ onClick: () => void }>(message))
    throw new Error('Missing cancel control');
  act(() => {
    message.props.onClick();
  });
  expect(firstSignal?.aborted).toBe(true);
  expect(secondSignal?.aborted).toBe(false);
  await act(async () => {
    first.finish();
    await a;
  });
  expect(result.current.second.active).toBe(true);
  expect(hideNotification).not.toHaveBeenCalledWith(notifications[1][0].id);
  await act(async () => {
    second.finish();
    await b;
  });
});

it('clears loading state and reports an action that throws without calling a callback', async () => {
  const { result } = renderHook(() =>
    useDownloadAction({
      actionFunction: async () => {
        throw new Error('Transport unavailable');
      },
      actionArgs: {},
    }),
  );
  await act(async () => {
    await result.current.handleClick();
  });
  expect(result.current.active).toBe(false);
  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Transport unavailable' }),
  );
});
