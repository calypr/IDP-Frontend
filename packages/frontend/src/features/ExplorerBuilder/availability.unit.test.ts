import { isExplorerBuilderEnabled } from './availability';

describe('Explorer Builder availability', () => {
  const original = process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
  afterEach(() => {
    if (original === undefined)
      delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
    else process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = original;
  });
  it('is disabled by default', () => {
    delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
    expect(isExplorerBuilderEnabled()).toBe(false);
  });
  it.each(['false', '1', 'TRUE', ''])(
    'does not enable authoring for %s',
    (value) => {
      process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = value;
      expect(isExplorerBuilderEnabled()).toBe(false);
    },
  );
  it('allows an explicit authoring opt-in', () => {
    process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = 'true';
    expect(isExplorerBuilderEnabled()).toBe(true);
  });
});
