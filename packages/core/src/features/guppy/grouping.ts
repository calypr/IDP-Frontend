import type { IndexAndField } from './types';

export const groupSharedFields = (data: Record<string, string[]>) => {
  const reverseIndex: Record<string, Set<string>> = {};

  for (const rootKey in data) {
    data[rootKey].forEach((value) => {
      if (!reverseIndex[value]) reverseIndex[value] = new Set();
      reverseIndex[value].add(rootKey);
    });
  }

  return Object.entries(reverseIndex).reduce(
    (acc, [field, indexSet]) => {
      if (indexSet.size > 1) {
        acc[field] = Array.from(indexSet).map((index) => ({ index, field }));
      }
      return acc;
    },
    {} as Record<string, Array<IndexAndField>>,
  );
};
