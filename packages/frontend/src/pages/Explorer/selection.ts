import { useState } from 'react';
import type { ExplorerRuntimeV1 } from '@gen3/core';

export const selectedProjectViewId = (
  explicitId: string | undefined,
  defaultId: string | undefined,
): string => explicitId || defaultId || 'default';

export const selectedProjectViewTab = (
  runtime: ExplorerRuntimeV1 | null | undefined,
  frameId: string | undefined,
): string | null => {
  if (!runtime) return null;
  if (!frameId) return runtime.outputs[0]?.title ?? null;
  return (
    runtime.outputs.find(
      (item) => `${item.selector.recipe}/${item.selector.output}` === frameId,
    )?.title ?? null
  );
};

export const useProjectViewTab = (
  runtime: ExplorerRuntimeV1 | null | undefined,
  frameId: string | undefined,
  viewId: string,
) => {
  const key = JSON.stringify([
    viewId,
    frameId,
    runtime?.generation,
    runtime?.outputs,
  ]);
  const initial = selectedProjectViewTab(runtime, frameId);
  const [selection, setSelection] = useState({ key, value: initial });
  return {
    activeTab: selection.key === key ? selection.value : initial,
    selectTab: (value: string | null) => setSelection({ key, value }),
    unavailableDefault: Boolean(frameId && runtime && initial === null),
  };
};
