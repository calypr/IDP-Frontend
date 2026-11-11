import { act, renderHook } from '@testing-library/react';
import type { ExplorerRuntimeV1 } from '@gen3/core';
import {
  selectedProjectViewId,
  selectedProjectViewTab,
  useProjectViewTab,
} from './selection';

const table = (name: string) => ({
  outputId: name,
  name,
  title: `${name} tab`,
  rowLabel: 'record',
  selector: { recipe: 'metadata', translationVersion: 'v1', output: name },
  columns: [],
  table: { columns: [] },
  filters: [],
  charts: [],
  fixedFilters: {},
});
const runtime: ExplorerRuntimeV1 = {
  generation: 'generation-a',
  outputs: [table('Documents'), table('Specimens')],
  sharedFilters: {},
  diagnostics: [],
};

it('uses an explicit view before the project default, with a legacy fallback only when unset', () => {
  expect(selectedProjectViewId('custom', 'files')).toBe('custom');
  expect(selectedProjectViewId(undefined, 'files')).toBe('files');
  expect(selectedProjectViewId(undefined, undefined)).toBe('default');
});
it('selects the qualified actual dataframe and keeps unavailable defaults unselected', () => {
  expect(selectedProjectViewTab(runtime, 'metadata/Specimens')).toBe(
    'Specimens tab',
  );
  expect(selectedProjectViewTab(runtime, 'other/Specimens')).toBeNull();
  expect(selectedProjectViewTab(runtime, 'metadata/Removed')).toBeNull();
  expect(selectedProjectViewTab(runtime, undefined)).toBe('Documents tab');
});
it('keeps manual tabs until the view or default changes without synchronization effects', () => {
  const { result, rerender } = renderHook(
    ({ frame }) => useProjectViewTab(runtime, frame, 'files'),
    { initialProps: { frame: 'metadata/Specimens' } },
  );
  expect(result.current.activeTab).toBe('Specimens tab');
  act(() => result.current.selectTab('Documents tab'));
  expect(result.current.activeTab).toBe('Documents tab');
  rerender({ frame: 'metadata/Documents' });
  expect(result.current.activeTab).toBe('Documents tab');
  rerender({ frame: 'metadata/Removed' });
  expect(result.current.activeTab).toBeNull();
  expect(result.current.unavailableDefault).toBe(true);
});
