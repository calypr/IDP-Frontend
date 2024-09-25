import { QueryResponse } from '../types';

export const isQueryResponse = (obj: any): obj is QueryResponse => {
  // Considering that the data property can be optional
  return (
    typeof obj === 'object' &&
    (obj.data === undefined || typeof obj.data === 'object')
  );
};

export function extractData(
  response: QueryResponse,
  index: string,
  aggregation_val: string,
) {
  if (aggregation_val !== '') {
    const aggregationData = response.data._aggregation[index]; // Access using string key
    if (aggregationData && aggregation_val in aggregationData) {
      const histogram = aggregationData[aggregation_val]?.histogram;
      return Array.isArray(histogram) && histogram.length > 0 ? histogram : [];
    }
  }
  // Handle the case for data without aggregation
  return Array.isArray(response.data[index]) && response.data[index].length > 0
    ? response.data[index]
    : [];
}
