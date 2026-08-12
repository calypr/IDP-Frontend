import {
  buildPreviewCacheKey,
  canonicalizeAuthoringDocument,
  createExplorerBuilderSession,
  explorerBuilderReducer,
  PREVIEW_DEBOUNCE_MS,
  schedulePreview,
} from './session';

const project = { organization: 'org', project: 'project' };

describe('Explorer builder session', () => {
  it('schedules opt-in live preview after the contract debounce', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    const cancel = schedulePreview(callback);
    jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 1);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    cancel();
    jest.useRealTimers();
  });
  it('canonicalizes object keys while retaining array order', () => {
    expect(
      canonicalizeAuthoringDocument({ z: 1, a: { y: 2, x: [3, 1] } }),
    ).toBe('{"a":{"x":[3,1],"y":2},"z":1}');
  });

  it('keys previews by a SHA-256 digest of project, canonical recipe, output, and limit', async () => {
    const first = await buildPreviewCacheKey(project, { b: 2, a: 1 }, 'Files', 25);
    const second = await buildPreviewCacheKey(project, { a: 1, b: 2 }, 'Files', 25);
    const other = await buildPreviewCacheKey(project, { a: 1, b: 2 }, 'Files', 50);
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first.startsWith('sha256:') || first.startsWith('canonical:')).toBe(
      true,
    );
  });

  it('discards superseded preview responses', () => {
    const initial = createExplorerBuilderSession(project);
    const first = explorerBuilderReducer(initial, {
      type: 'previewLoading',
      output: 'Files',
      key: 'old',
    });
    const second = explorerBuilderReducer(first, {
      type: 'previewLoading',
      output: 'Files',
      key: 'new',
    });
    const stale = explorerBuilderReducer(second, {
      type: 'previewReady',
      output: 'Files',
      key: 'old',
      data: {
        output: 'Files',
        columns: [],
        rows: [],
        rowCount: 0,
        validation: { outputs: [], diagnostics: [] },
      },
    });
    expect(stale).toBe(second);
    expect(stale.previewByOutput.Files.key).toBe('new');
  });

  it('tracks recipe and Explorer dirty state independently', () => {
    const recipeEdited = explorerBuilderReducer(
      createExplorerBuilderSession(project),
      {
        type: 'editRecipe',
        draft: { outputs: [] },
      },
    );
    expect(recipeEdited.recipeDirty).toBe(true);
    expect(recipeEdited.explorerDirty).toBe(false);
  });
});
