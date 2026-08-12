import type { ExplorerAuthoringDocument } from '@gen3/core';

export const emptyExplorerDocument = (): ExplorerAuthoringDocument => ({
  schemaVersion: 1,
  tabs: [],
});
