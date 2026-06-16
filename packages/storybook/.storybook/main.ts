import * as path from 'path';
import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: [
    '../../frontend/src/components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../frontend/src/features/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../frontend/src/pages/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    'storybook-addon-deep-controls',
  ],
  typescript: {
    check: false,
    checkOptions: {},
    skipCompiler: false,
  },
  framework: {
    name: '@storybook/nextjs-vite',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(__dirname, '../next.config.js'),
    },
  },
  staticDirs: ['../../sampleCommons/public'],
  viteFinal: async (config) => {
    const publicEnv = Object.entries(process.env).reduce<
      Record<string, string>
    >((acc, [key, value]) => {
      if (key.startsWith('NEXT_PUBLIC_') && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    return mergeConfig(config, {
      define: {
        'process.env': JSON.stringify({
          NODE_ENV: process.env.NODE_ENV ?? 'development',
          ...publicEnv,
        }),
      },
    });
  },
};
export default config;
