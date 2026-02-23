import { CSSProperties } from 'react';

export const isArrayOfString = (value: unknown): value is Array<string> => {
  return (
    Array.isArray(value) &&
    value.every((element) => typeof element === 'string')
  );
};

// Define the valid textTransform values
const validTextTransforms: Array<CSSProperties['textTransform']> = [
  'none',
  'capitalize',
  'uppercase',
  'lowercase',
  'full-width',
  'full-size-kana',
  'inherit',
  'initial',
  'revert',
  'unset',
];

// Type guard function
export const isTextTransform = (
  value: unknown,
): value is CSSProperties['textTransform'] => {
  return (validTextTransforms as Array<unknown>).includes(value);
};
