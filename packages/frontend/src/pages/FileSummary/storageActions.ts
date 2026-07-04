import type { AuditActionOption } from './storageTypes';

const storageActionMetadata = (
  action: string,
): Omit<AuditActionOption, 'action'> => {
  switch (action) {
    case 'remove_broken_access_urls':
      return {
        destructive: true,
        label: 'Repair access URLs',
        requiresConfirmation: true,
        supportsDryRun: true,
      };
    case 'delete_syfon_record':
    case 'delete_records':
      return {
        destructive: true,
        label: 'Delete Syfon records',
        requiresConfirmation: true,
        supportsDryRun: true,
      };
    case 'delete_bucket_object':
      return {
        destructive: true,
        label: 'Delete bucket objects',
        requiresConfirmation: true,
        supportsDryRun: true,
      };
    case 'delete_both':
      return {
        destructive: true,
        label: 'Delete records and bucket objects',
        requiresConfirmation: true,
        supportsDryRun: true,
      };
    case 'inspect_evidence':
      return {
        destructive: false,
        label: 'Show paths',
        requiresConfirmation: false,
        supportsDryRun: false,
      };
    default:
      return {
        destructive: false,
        label: action
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (value) => value.toUpperCase()),
        requiresConfirmation: false,
        supportsDryRun: false,
      };
  }
};

const normalizeAuditActionOption = (
  item: unknown,
): AuditActionOption | null => {
  if (typeof item === 'string') {
    const action = item.trim();
    if (!action) {
      return null;
    }

    return {
      action,
      ...storageActionMetadata(action),
    };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  const actionValue =
    typeof record.action === 'string'
      ? record.action.trim()
      : typeof record.kind === 'string'
        ? record.kind.trim()
        : typeof record.id === 'string'
          ? record.id.trim()
          : '';

  if (!actionValue) {
    return null;
  }

  const labelValue =
    typeof record.label === 'string'
      ? record.label.trim()
      : typeof record.title === 'string'
        ? record.title.trim()
        : typeof record.display_name === 'string'
          ? record.display_name.trim()
          : '';

  return {
    action: actionValue,
    description:
      typeof record.description === 'string'
        ? record.description
        : typeof record.help_text === 'string'
          ? record.help_text
          : undefined,
    destructive:
      typeof record.destructive === 'boolean'
        ? record.destructive
        : typeof record.is_destructive === 'boolean'
          ? record.is_destructive
          : storageActionMetadata(actionValue).destructive,
    label: labelValue || storageActionMetadata(actionValue).label,
    requiresConfirmation:
      typeof record.requires_confirmation === 'boolean'
        ? record.requires_confirmation
        : typeof record.requiresConfirmation === 'boolean'
          ? record.requiresConfirmation
          : storageActionMetadata(actionValue).requiresConfirmation,
    supportsDryRun:
      typeof record.supports_dry_run === 'boolean'
        ? record.supports_dry_run
        : typeof record.supportsDryRun === 'boolean'
          ? record.supportsDryRun
          : storageActionMetadata(actionValue).supportsDryRun,
  };
};

export const normalizeAvailableActions = (
  item: Record<string, unknown>,
): Array<AuditActionOption> => {
  const rawActions = Array.isArray(item.available_actions)
    ? item.available_actions
    : Array.isArray(item.availableActions)
      ? item.availableActions
      : [];

  const normalized = rawActions
    .map((action) => normalizeAuditActionOption(action))
    .filter((action): action is AuditActionOption => action !== null);

  return Array.from(
    new Map(normalized.map((action) => [action.action, action])).values(),
  );
};

export const normalizeDefaultAction = (
  item: Record<string, unknown>,
): string | undefined => {
  if (typeof item.default_action === 'string' && item.default_action.trim()) {
    return item.default_action.trim();
  }
  if (typeof item.defaultAction === 'string' && item.defaultAction.trim()) {
    return item.defaultAction.trim();
  }

  const defaultActionRecord =
    item.default_action && typeof item.default_action === 'object'
      ? normalizeAuditActionOption(item.default_action)
      : item.defaultAction && typeof item.defaultAction === 'object'
        ? normalizeAuditActionOption(item.defaultAction)
        : null;

  return defaultActionRecord?.action;
};
