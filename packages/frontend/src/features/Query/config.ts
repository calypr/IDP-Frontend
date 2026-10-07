import { GEN3_LOOM_API } from '@gen3/core';
import type {
  QueryConfiguration,
  QueryEndpointConfiguration,
  QueryEndpointService,
  QueryEndpointSurface,
  QueryModePreset,
} from './types';

export interface QueryConfigIssue {
  readonly path: string;
  readonly message: string;
}

export class QueryConfigurationError extends Error {
  readonly issues: readonly QueryConfigIssue[];

  constructor(issues: readonly QueryConfigIssue[]) {
    super(
      `Invalid Query configuration:\n${issues
        .map(({ path, message }) => `- ${path}: ${message}`)
        .join('\n')}`,
    );
    this.name = 'QueryConfigurationError';
    this.issues = issues;
  }
}

const DEFAULT_QUERY_ENDPOINT = `${GEN3_LOOM_API.replace(/\/+$/, '')}/graphql/flat`;
const DEFAULT_GRAPH_ENDPOINT = `${GEN3_LOOM_API.replace(/\/+$/, '')}/graphql/graph`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPreset = (value: unknown): value is QueryModePreset =>
  value === 'loom-fhir-graph' ||
  value === 'loom-fhir-dataframe' ||
  value === 'loom-flat' ||
  value === 'guppy-flat' ||
  value === 'generic';

const isService = (value: unknown): value is QueryEndpointService =>
  value === 'loom' || value === 'guppy' || value === 'generic';

const isSurface = (value: unknown): value is QueryEndpointSurface =>
  value === 'graph' || value === 'flat' || value === 'graphql';

const endpointPath = (url: string): string => {
  try {
    return new URL(url, 'https://gen3.invalid').pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

export const validateEndpointUrl = (
  url: unknown,
  path: string,
): QueryConfigIssue[] => {
  if (typeof url !== 'string' || url.trim() === '') {
    return [{ path, message: 'must be a non-empty URL string' }];
  }

  const trimmed = url.trim();
  if (trimmed.startsWith('//')) {
    return [{ path, message: 'protocol-relative URLs are not allowed' }];
  }
  if (/[#]/.test(trimmed)) {
    return [{ path, message: 'URL fragments are not allowed' }];
  }
  if (/^(javascript|data|blob):/i.test(trimmed)) {
    return [{ path, message: 'unsafe URL schemes are not allowed' }];
  }

  try {
    const parsed = new URL(trimmed, 'https://gen3.invalid');
    const isRelative = !/^[a-z][a-z\d+.-]*:/i.test(trimmed);
    if (!isRelative && parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return [{ path, message: 'only HTTP and HTTPS URLs are allowed' }];
    }
    if (parsed.username || parsed.password) {
      return [{ path, message: 'URLs must not contain credentials' }];
    }
  } catch {
    return [{ path, message: 'must be a valid HTTP URL or root-relative path' }];
  }
  return [];
};

const validateEndpointContract = (
  endpoint: QueryEndpointConfiguration,
  path: string,
): QueryConfigIssue[] => {
  const issues = validateEndpointUrl(endpoint.url, `${path}.url`);
  if (!isService(endpoint.service)) {
    issues.push({
      path: `${path}.service`,
      message: 'must be loom, guppy, or generic',
    });
  }
  if (!isSurface(endpoint.surface)) {
    issues.push({
      path: `${path}.surface`,
      message: 'must be graph, flat, or graphql',
    });
  }

  const endpointPathname = endpointPath(endpoint.url);
  if (endpoint.service === 'loom') {
    if (
      endpoint.surface === 'graph' &&
      !endpointPathname.endsWith('/graphql/graph')
    ) {
      issues.push({
        path: `${path}.url`,
        message: 'Loom graph endpoints must end in /graphql/graph',
      });
    }
    if (
      endpoint.surface === 'flat' &&
      !endpointPathname.endsWith('/graphql/flat')
    ) {
      issues.push({
        path: `${path}.url`,
        message: 'Loom flat endpoints must end in /graphql/flat',
      });
    }
  }
  return issues;
};

const cloneVariables = (variables: unknown): Record<string, unknown> => {
  if (!isRecord(variables)) return {};
  return JSON.parse(JSON.stringify(variables)) as Record<string, unknown>;
};

const legacyEndpoint = (value: unknown): QueryEndpointConfiguration | null => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const url = value.trim().replace(/\/+$/, '');
  const pathname = endpointPath(url);
  if (/\/guppy\/graphql(?:\/)?$/.test(pathname) || /guppy/i.test(url)) {
    return { url, service: 'guppy', surface: 'graphql' };
  }
  if (pathname.endsWith('/graphql/graph')) {
    return { url, service: 'loom', surface: 'graph' };
  }
  if (pathname.endsWith('/graphql/flat')) {
    return { url, service: 'loom', surface: 'flat' };
  }
  return null;
};

const defaultConfiguration = (): QueryConfiguration => ({
  version: 2,
  endpoints: {
    loomGraph: {
      url: DEFAULT_GRAPH_ENDPOINT,
      service: 'loom',
      surface: 'graph',
    },
    loomFlat: {
      url: DEFAULT_QUERY_ENDPOINT,
      service: 'loom',
      surface: 'flat',
    },
  },
  modes: [
    {
      id: 'loom-fhir-graph',
      label: 'Loom Graph',
      endpoint: 'loomGraph',
      preset: 'loom-fhir-graph',
    },
    {
      id: 'loom-fhir-dataframe',
      label: 'Loom Dataframe',
      endpoint: 'loomGraph',
      preset: 'loom-fhir-dataframe',
    },
    {
      id: 'loom-flat',
      label: 'Loom Flat',
      endpoint: 'loomFlat',
      preset: 'loom-flat',
    },
  ],
  defaultMode: 'loom-flat',
});

const legacyConfiguration = (value: unknown): QueryConfiguration => {
  const hasLegacyEndpoint = isRecord(value) && 'graphQLEndpoint' in value;
  const legacy = isRecord(value) ? legacyEndpoint(value.graphQLEndpoint) : null;
  if (!legacy) {
    if (hasLegacyEndpoint && isRecord(value) && value.graphQLEndpoint) {
      throw new QueryConfigurationError([
        {
          path: 'graphQLEndpoint',
          message: 'must be a supported Loom or Guppy GraphQL endpoint',
        },
      ]);
    }
    return defaultConfiguration();
  }
  const endpointIssues = validateEndpointContract(legacy, 'endpoints.legacy');
  if (endpointIssues.length) throw new QueryConfigurationError(endpointIssues);

  if (legacy.service === 'guppy') {
    return {
      version: 2,
      endpoints: { guppy: legacy },
      modes: [
        {
          id: 'guppy-flat',
          label: 'Guppy',
          endpoint: 'guppy',
          preset: 'guppy-flat',
        },
      ],
      defaultMode: 'guppy-flat',
    };
  }

  const graph = legacy.surface === 'graph' ? legacy : {
    ...legacy,
    url: legacy.url.replace(/\/graphql\/flat$/, '/graphql/graph'),
    surface: 'graph' as const,
  };
  const flat = {
    ...graph,
    url: graph.url.replace(/\/graphql\/graph$/, '/graphql/flat'),
    surface: 'flat' as const,
  };
  return {
    version: 2,
    endpoints: { loomGraph: graph, loomFlat: flat },
    modes: [
      {
        id: 'loom-fhir-graph',
        label: 'Loom Graph',
        endpoint: 'loomGraph',
        preset: 'loom-fhir-graph',
      },
      {
        id: 'loom-fhir-dataframe',
        label: 'Loom Dataframe',
        endpoint: 'loomGraph',
        preset: 'loom-fhir-dataframe',
      },
      {
        id: 'loom-flat',
        label: 'Loom Flat',
        endpoint: 'loomFlat',
        preset: 'loom-flat',
      },
    ],
    defaultMode: 'loom-flat',
  };
};

export const validateQueryConfiguration = (
  value: unknown,
): QueryConfigIssue[] => {
  const issues: QueryConfigIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: '$', message: 'must be a JSON object' }];
  }
  if (value.version !== 2) {
    issues.push({ path: 'version', message: 'must be 2' });
  }
  if (!isRecord(value.endpoints)) {
    issues.push({ path: 'endpoints', message: 'must be an object' });
  }
  if (!Array.isArray(value.modes) || value.modes.length === 0) {
    issues.push({ path: 'modes', message: 'must be a non-empty array' });
  }
  const endpoints = isRecord(value.endpoints) ? value.endpoints : {};
  for (const [id, endpoint] of Object.entries(endpoints)) {
    if (!isRecord(endpoint)) {
      issues.push({ path: `endpoints.${id}`, message: 'must be an object' });
      continue;
    }
    issues.push(
      ...validateEndpointContract(endpoint as unknown as QueryEndpointConfiguration, `endpoints.${id}`),
    );
  }
  const modeIds = new Set<string>();
  if (Array.isArray(value.modes)) {
    value.modes.forEach((mode, index) => {
      const path = `modes[${index}]`;
      if (!isRecord(mode)) {
        issues.push({ path, message: 'must be an object' });
        return;
      }
      if (typeof mode.id !== 'string' || !mode.id) {
        issues.push({ path: `${path}.id`, message: 'must be non-empty' });
      } else if (modeIds.has(mode.id)) {
        issues.push({ path: `${path}.id`, message: 'must be unique' });
      } else {
        modeIds.add(mode.id);
      }
      if (typeof mode.label !== 'string' || !mode.label) {
        issues.push({ path: `${path}.label`, message: 'must be non-empty' });
      }
      if (typeof mode.endpoint !== 'string' || !endpoints[mode.endpoint]) {
        issues.push({ path: `${path}.endpoint`, message: 'must reference an endpoint' });
      }
      if (!isPreset(mode.preset)) {
        issues.push({ path: `${path}.preset`, message: 'must be a supported preset' });
      }
    });
  }
  if (typeof value.defaultMode !== 'string' || !modeIds.has(value.defaultMode)) {
    issues.push({ path: 'defaultMode', message: 'must reference a configured mode' });
  }
  return issues;
};

export const normalizeQueryConfiguration = (
  value: unknown,
): QueryConfiguration => {
  if (!isRecord(value) || value.version !== 2) {
    return legacyConfiguration(value);
  }

  const issues = validateQueryConfiguration(value);
  if (issues.length) throw new QueryConfigurationError(issues);

  const config = value as unknown as QueryConfiguration;
  return {
    ...config,
    endpoints: { ...config.endpoints },
    modes: config.modes.map((mode) => ({ ...mode })),
  };
};

export const parseVariables = (value: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error('Variables must be a JSON object');
  return parsed;
};

export const copyVariables = cloneVariables;

export const isQueryConfiguration = (
  value: unknown,
): value is QueryConfiguration =>
  isRecord(value) && value.version === 2 && validateQueryConfiguration(value).length === 0;
