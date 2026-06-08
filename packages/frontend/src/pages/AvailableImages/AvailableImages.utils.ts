export interface FileActionsConfig {
  actions?: Record<string, string>;
  extensions?: Record<string, Array<string>>;
}

export interface FileActionsConfigByProject {
  configId: string;
  fileActions: FileActionsConfig;
  projectIds: Array<string>;
}

export const sortConfigIds = (configIds: Array<string>): Array<string> =>
  [...configIds].sort((left, right) => left.localeCompare(right));

export const mergeFileActionsConfig = (
  base: FileActionsConfig | undefined,
  incoming: FileActionsConfig,
): FileActionsConfig => {
  const mergedExtensions = {
    ...(base?.extensions ?? {}),
  } as Record<string, Array<string>>;

  for (const [extension, actions] of Object.entries(incoming.extensions ?? {})) {
    const existingActions = mergedExtensions[extension] ?? [];
    mergedExtensions[extension] = Array.from(
      new Set([...existingActions, ...actions]),
    );
  }

  return {
    actions: {
      ...(base?.actions ?? {}),
      ...(incoming.actions ?? {}),
    },
    extensions: mergedExtensions,
  };
};

export const buildDeterministicFileActionsMap = (
  configs: Array<FileActionsConfigByProject>,
): Record<string, FileActionsConfig> => {
  const map: Record<string, FileActionsConfig> = {};

  for (const config of [...configs].sort((left, right) =>
    left.configId.localeCompare(right.configId),
  )) {
    for (const projectId of config.projectIds) {
      map[projectId] = mergeFileActionsConfig(map[projectId], config.fileActions);
    }
  }

  return map;
};
