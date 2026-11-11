export const isExplorerBuilderEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED === 'true';
