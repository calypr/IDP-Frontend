import { z } from 'zod';
import { isFilterSet, type FilterSet } from '@gen3/core';

const selector = z.object({
  recipe: z.string().min(1),
  translationVersion: z.string().min(1),
  output: z.string().min(1),
});
const sort = z
  .union([
    z.object({ column: z.string(), desc: z.boolean().optional() }),
    z
      .array(z.record(z.string(), z.enum(['asc', 'desc'])))
      .transform((values) => {
        const first = values[0];
        if (!first) return undefined;
        const entry = Object.entries(first)[0];
        return entry
          ? { column: entry[0], desc: entry[1] === 'desc' }
          : undefined;
      }),
  ])
  .optional();

export const downloadParameters = z.object({
  selector,
  projectIds: z.array(z.string()).optional(),
  filter: z
    .custom<FilterSet>(isFilterSet, 'Invalid download filters')
    .optional(),
  sort,
  fields: z.array(z.string()).default([]),
  fileFields: z.array(z.string()).optional(),
  exportHeaders: z.record(z.string(), z.string()).optional(),
  filename: z.string().optional(),
  type: z.string().default('data'),
});

export const fileDownloadParameters = downloadParameters.extend({
  format: z.enum(['json', 'csv', 'tsv', 'jsonl']).default('json'),
});
export const manifestDownloadParameters = downloadParameters.extend({
  resourceIndexType: z.string(),
  resourceIdField: z.string(),
  referenceIdFieldInDataIndex: z.string().optional(),
  referenceIdFieldInResourceIndex: z.string().optional(),
  resourceSelector: selector.optional(),
});
