import { QueryResponse } from '../types';

/**
 * Checks if the given object is a QueryResponse.
 *
 * @param {any} obj - The object to be checked.
 * @returns {boolean} Returns true if the object is a QueryResponse, false otherwise.
 */
export const isQueryResponse = (obj: any): obj is QueryResponse => {
  // Considering that the data property can be optional
  return (
    typeof obj === 'object' &&
    (obj.data === undefined || typeof obj.data === 'object')
  );
};

/**
 * Checks if QueryResponse is populated then indexes to the inner list
 *
 * @param {QueryResponse} response The fetch response object to be indexed
   @param {string} index The name to index on
   @param {string} aggregation_val If fetch response is an aggregation response, the index to index on
 * @returns {Record<string, any> || AggregationData}
 */
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
  return Array.isArray(response.data[index]) && response.data[index].length > 0
    ? response.data[index]
    : [];
}
