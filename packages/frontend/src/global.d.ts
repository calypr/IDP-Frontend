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
    interface Matchers<R, T = object> {
        toBeInTheDocument(): R;
        toBeVisible(): R;
        toBeDisabled(): R;
    }
}
