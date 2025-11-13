'use strict';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const storybook = require('..');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require('assert').strict;

assert.strictEqual(storybook(), 'Hello from storybook');
console.info('storybook tests passed');
