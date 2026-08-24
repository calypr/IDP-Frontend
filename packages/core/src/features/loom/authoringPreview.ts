import type { ExplorerPreview } from './explorerApi';

export interface AuthoringColumnBinding {
  readonly outputId: string;
  readonly semanticColumn: string;
  readonly label?: string;
  readonly candidateId: string;
  readonly occurrenceId: string;
  readonly emissionId?: string;
}

export interface AuthoringPreviewResponse {
  readonly outputId?: string;
  readonly columns: ReadonlyArray<Record<string, unknown> | string>;
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly rowCount?: number;
  readonly intentDigest?: string;
  readonly sourceGeneration?: string;
  readonly diagnostics?: ReadonlyArray<unknown>;
}

export interface AuthoringPreviewBindingError {
  readonly status: 502;
  readonly code: 'PREVIEW_COLUMN_BINDING_FAILED';
  readonly message: string;
  readonly retryable: false;
  readonly details: {
    readonly outputId: string;
    readonly unmatchedColumns: ReadonlyArray<string>;
  };
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * Bind a native Authoring V1 preview to Builder display metadata.
 *
 * Emission identity is authoritative. Candidate/occurrence identity is only a
 * compatibility fallback for older Loom responses. Rows are intentionally
 * allowed to be sparse: an absent property represents a null/absent value and
 * must not invalidate an otherwise well-formed preview.
 */
export const bindAuthoringPreview = (
  response: AuthoringPreviewResponse,
  bindings: ReadonlyArray<AuthoringColumnBinding>,
  output: string,
  diagnostics: (
    value: unknown,
  ) => NonNullable<ExplorerPreview['diagnostics']>[number],
): { readonly data: ExplorerPreview } | { readonly error: AuthoringPreviewBindingError } => {
  const byEmission = new Map(
    bindings.flatMap((binding) =>
      binding.emissionId ? [[binding.emissionId, binding] as const] : [],
    ),
  );
  const byOccurrence = new Map(
    bindings.map((binding) => [
      `${binding.candidateId}\u0000${binding.occurrenceId}`,
      binding,
    ]),
  );
  const unmatchedColumns: string[] = [];
  const columns = response.columns.flatMap((rawColumn, index) => {
    const column = typeof rawColumn === 'string' ? undefined : rawColumn;
    const rowKey =
      typeof rawColumn === 'string'
        ? text(rawColumn)
        : text(column?.publicColumn) ?? text(column?.name);
    const emissionId = text(column?.emissionId);
    const candidateId = text(column?.candidateId);
    const occurrenceId = text(column?.occurrenceId);
    const binding =
      (emissionId ? byEmission.get(emissionId) : undefined) ??
      (candidateId && occurrenceId
        ? byOccurrence.get(`${candidateId}\u0000${occurrenceId}`)
        : undefined);
    if (!rowKey || !binding) {
      unmatchedColumns.push(
        rowKey ?? emissionId ?? candidateId ?? `column[${index}]`,
      );
      return [];
    }
    return [{
      name: binding.semanticColumn,
      rowKey,
      emissionId: emissionId ?? binding.emissionId,
      candidateId: candidateId ?? binding.candidateId,
      occurrenceId: occurrenceId ?? binding.occurrenceId,
      ...(binding.label ? { label: binding.label } : {}),
      logicalType: text(column?.logicalType),
      filterable: column?.filterable !== false,
      chartable: column?.chartable === true,
    }];
  });

  if (unmatchedColumns.length > 0) {
    return {
      error: {
        status: 502,
        code: 'PREVIEW_COLUMN_BINDING_FAILED',
        message:
          'Loom returned preview columns that do not match the current Builder emissions.',
        retryable: false,
        details: { outputId: output, unmatchedColumns },
      },
    };
  }

  return {
    data: {
      output,
      columns,
      rows: response.rows,
      rowCount:
        typeof response.rowCount === 'number'
          ? response.rowCount
          : response.rows.length,
      digest: response.intentDigest,
      recipeDigest: undefined,
      resolvedSchemaDigest: undefined,
      sourceGeneration: response.sourceGeneration,
      diagnostics: (response.diagnostics ?? []).map(diagnostics),
    },
  };
};
