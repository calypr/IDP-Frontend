export function extractData(
  response: any,
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
