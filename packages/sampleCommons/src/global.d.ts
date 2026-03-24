import React from 'react';
import '@testing-library/jest-dom';

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementClass = React.JSX.ElementClass;
    type IntrinsicElements = React.JSX.IntrinsicElements;
  }
}

declare module 'jest' {
  /* Changed T to _T and {} to Record<string, unknown> */
  interface Matchers<R, _T = Record<string, unknown>> {
    toBeInTheDocument(): R;
    toBeVisible(): R;
    toBeDisabled(): R;
  }
}
