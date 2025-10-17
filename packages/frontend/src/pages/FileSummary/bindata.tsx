import { formatBytes, capitalize } from '../../utils/labels';

export const convertSlicePointsToRangeMap = (
  points: number[],
): Record<string, [number, number]> => {
  const rangeMap: Record<string, [number, number]> = {};

  for (let i = 0; i < points.length - 1; i++) {
    const lower = points[i];
    const upper = points[i + 1];
    const key = capitalize(
      `${formatBytes(lower, 2)} - ${formatBytes(upper, 2)}`,
    );
    rangeMap[key] = [lower, upper];
  }

  return rangeMap;
};

type FileData = { document_reference_size: string };

export function binDataWithCustomBoundaries(
  data: FileData[],
  boundaries: number[],
): { key: string; count: number }[] {
  const sizes = data
    .map((file) => parseFloat(file.document_reference_size))
    .filter((size) => !isNaN(size));

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const bins = sortedBoundaries.slice(1).map((upperBoundary, index) => ({
    key: `${formatBytes(sortedBoundaries[index], 2)} - ${formatBytes(upperBoundary, 2)}`,
    count: 0,
  }));

  sizes.forEach((size) => {
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      if (size >= sortedBoundaries[i] && size < sortedBoundaries[i + 1]) {
        bins[i].count += 1;
        break;
      }
    }
  });

  return bins;
}
