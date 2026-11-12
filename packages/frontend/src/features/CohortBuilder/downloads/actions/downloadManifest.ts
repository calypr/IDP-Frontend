import {
  downloadLoomRows,
  FilterSet,
  LoomRowsDownloadParams,
  JSONObject,
} from '@gen3/core';
import { handleDownload } from './utils';
import { manifestDownloadParameters } from './downloadParameters';

const DEFAULT_FILE_FIELDS = ['file_name', 'file_size', 'md5sum', 'object_id'];

/**
 * Process the manifest data given the data and the fields to include in the manifest.
 * Check if the item in the data contains the fields to include in the manifest.
 * if not, remove the item from the data.
 * @param data
 * @param resourceIdField
 * @param manifestFields
 */
export const processManifest = (
  data: JSONObject[],
  resourceIdField: string,
  manifestFields: string[],
) => {
  return data.filter((item) => {
    const hasAllFields = manifestFields.every((field) => {
      return item[field] !== undefined;
    });
    return hasAllFields && item[resourceIdField] !== undefined;
  });
};

export const downloadToManifestAction = async (
  params: Record<string, unknown>,
  done?: () => void,
  onError?: (error: Error) => void,
  onAbort?: () => void,
  signal?: AbortSignal,
  dataFormat?: string,
): Promise<void> => {
  try {
    const parsed = manifestDownloadParameters.parse(params);
    const fields = parsed.fileFields ?? DEFAULT_FILE_FIELDS;
    const request: LoomRowsDownloadParams = {
      selector: parsed.selector,
      projectIds: parsed.projectIds,
      fields: parsed.fields,
      filter: parsed.filter,
      sort: parsed.sort,
    };
    let rows: JSONObject[];
    if (parsed.type === parsed.resourceIndexType) {
      const requestedFields = [
        ...new Set(
          [
            parsed.resourceIdField,
            parsed.referenceIdFieldInDataIndex,
            ...fields,
          ].filter((field): field is string => Boolean(field)),
        ),
      ];
      rows = processManifest(
        await downloadLoomRows({ ...request, fields: requestedFields }, signal),
        parsed.resourceIdField,
        fields,
      );
    } else {
      const {
        resourceSelector,
        referenceIdFieldInDataIndex,
        referenceIdFieldInResourceIndex,
      } = parsed;
      if (
        !resourceSelector ||
        !referenceIdFieldInDataIndex ||
        !referenceIdFieldInResourceIndex
      )
        throw new Error(
          'This manifest requires a published resource selector and source/resource reference fields.',
        );
      const references = await downloadLoomRows(
        { ...request, fields: [referenceIdFieldInDataIndex] },
        signal,
      );
      const ids = references
        .map((row) => row[referenceIdFieldInDataIndex])
        .filter(
          (value): value is string | number =>
            typeof value === 'string' || typeof value === 'number',
        );
      if (!ids.length) throw new Error('No data found for the current filters');
      const filter: FilterSet = {
        mode: 'and',
        root: {
          [referenceIdFieldInResourceIndex]: {
            operator: 'in',
            field: referenceIdFieldInResourceIndex,
            operands: ids,
          },
          ...(dataFormat
            ? {
                data_format: {
                  operator: '=' as const,
                  operand: dataFormat,
                  field: 'data_format',
                },
              }
            : {}),
        },
      };
      rows = (
        await downloadLoomRows(
          {
            ...request,
            selector: resourceSelector,
            sort: undefined,
            filter,
            fields: [
              ...new Set([
                referenceIdFieldInResourceIndex,
                parsed.resourceIdField,
                ...fields,
              ]),
            ],
          },
          signal,
        )
      )
        .filter((row) => Boolean(row[parsed.resourceIdField]))
        .map((row) => ({
          ...row,
          [parsed.resourceIdField]:
            typeof row[parsed.resourceIdField] === 'string'
              ? [row[parsed.resourceIdField]]
              : row[parsed.resourceIdField],
        }));
    }
    if (!rows.length) throw new Error('No data found for the current filters');
    signal?.throwIfAborted();
    handleDownload(
      new Blob([JSON.stringify(rows, null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
      parsed.filename ?? `${parsed.type}_manifest.json`,
    );
    done?.();
  } catch (error: unknown) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    )
      onAbort?.();
    else onError?.(error instanceof Error ? error : new Error(String(error)));
  }
};
