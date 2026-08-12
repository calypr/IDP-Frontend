export interface OutputColumnCapability {
  readonly filterable?: boolean;
  readonly sortable?: boolean;
  readonly aggregatable?: boolean;
  readonly logicalType?: string;
}

export const decorationCapability = (
  decoration: 'filter' | 'sort' | 'aggregate',
  capability: OutputColumnCapability | undefined,
): boolean => {
  if (!capability) return false;
  if (decoration === 'filter') return capability.filterable === true;
  if (decoration === 'sort') return capability.sortable === true;
  return capability.aggregatable === true;
};

export const preserveIncompatibleDecorations = <T extends Record<string, unknown>>(
  decorations: T,
  capabilities: Readonly<Record<string, OutputColumnCapability>>,
): T => ({
  ...decorations,
  _capabilityWarnings: Object.keys(decorations)
    .filter((field) => !capabilities[field])
    .map((field) => `Missing output capability for ${field}`),
}) as T;
