import {
  decorationCapability,
  preserveIncompatibleDecorations,
} from './capabilities';
import { emptyExplorerDocument } from './document';

describe('Explorer visual editor capability constraints', () => {
  it('starts authoring documents in the frozen tabs shape', () => {
    expect(emptyExplorerDocument()).toEqual({ schemaVersion: 1, tabs: [] });
  });

  it('allows only capabilities advertised by the pinned output schema', () => {
    expect(decorationCapability('filter', { filterable: true })).toBe(true);
    expect(decorationCapability('sort', { filterable: true })).toBe(false);
    expect(decorationCapability('aggregate', { aggregatable: false })).toBe(
      false,
    );
  });

  it('preserves incompatible decorations with visible warning metadata', () => {
    const decorated = preserveIncompatibleDecorations(
      { missingField: { label: 'Keep me' } },
      {},
    ) as unknown as { _capabilityWarnings: string[] };
    expect(decorated._capabilityWarnings).toEqual([
      'Missing output capability for missingField',
    ]);
  });
});
