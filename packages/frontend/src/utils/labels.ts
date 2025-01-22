import pluralize from 'pluralize';

/**
 * Convert label to pluralized (optional title case)
 * @param {label} string - a label to convert to title
 * @param {titleCase} boolean - Should first letter be capitalized default false
 * @returns {string} Pluralized formatted word
 */
export const labelToPlural = (label: string, titleCase = false) => {
  const pluralizedLabel = pluralize(label);
  if (titleCase) {
    return pluralizedLabel.charAt(0).toUpperCase() + pluralizedLabel.slice(1);
  }
  return pluralizedLabel.toLowerCase();
};

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formattedBytes = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

  return `${formattedBytes} ${sizes[i]}`;
};

export const capitalize = (original: string): string => {
  if (original === undefined) {
    throw new Error('capitalize: original is undefined');
  }
  if (original.length === 0) {
    return original;
  }
  return original
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};
