'use strict';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dns = require('dns');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const basePath = process.env.NEXT_PUBLIC_BASEPATH;
const workspaceRoot = path.resolve(__dirname, '../..');
const turbopackAliases = {
  // Resolve aliases from the Next application directory. `turbopack.root`
  // controls the filesystem boundary, but relative alias targets are still
  // interpreted from `packages/sampleCommons`.
  '@gen3/core': '../core/src/index.ts',
  '@gen3/frontend': '../frontend/src/index.ts',
};

dns.setDefaultResultOrder('ipv4first');

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./src/lib/plugins/index.js');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withMDX = require('@next/mdx')({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

// Next configuration with support for rewriting API to existing common services
const nextConfig = {
  reactStrictMode: true,
  // `standalone` is a production deployment artifact. Enabling it during
  // `next dev` makes Next's monorepo file tracer observe `.next/dev` and copy
  // its own Turbopack cache into `.next/standalone`, causing unbounded output.
  // Keep the optimized standalone server for production builds only.
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
  allowedDevOrigins: [
    'caliper-training.ohsu.edu',
    'caliper-training.ohsu.edu:3010',
    'local.io',
    '*.local.io',
  ],
  productionBrowserSourceMaps: true,
  pageExtensions: ['mdx', 'md', 'jsx', 'js', 'tsx', 'ts'],
  basePath: basePath,
  transpilePackages: ['@gen3/core', '@gen3/frontend'],
  experimental: {
    // Next 16.1 enables Turbopack's persistent dev cache by default. In this
    // monorepo the app aliases sibling workspace source directly, and restored
    // module graphs can miss edits under packages/core and packages/frontend.
    // Keep Turbopack/HMR, but rebuild its in-memory graph on each dev start.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    root: workspaceRoot,
    resolveAlias: turbopackAliases,
  },
  async headers() {
    return [
      {
        source: '/(.*)?', // Matches all pages
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
      {
        source: '/jupyter/(.*)?',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

module.exports = withMDX(nextConfig);
