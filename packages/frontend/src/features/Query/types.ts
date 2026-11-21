import type { JSONObject } from '@gen3/core';
import type { Gen3AppConfigData } from '../../lib/content/types';

export type QueryEndpointService = 'loom' | 'guppy' | 'generic';
export type QueryEndpointSurface = 'graph' | 'flat' | 'graphql';
export type QueryModePreset =
  | 'loom-fhir-graph'
  | 'loom-fhir-dataframe'
  | 'loom-flat'
  | 'guppy-flat'
  | 'generic';
export type ProjectBinding =
  | 'loom-input-project'
  | 'loom-project-filter'
  | 'guppy-auth-resource-path'
  | 'none';

export interface QueryEndpointConfiguration {
  readonly url: string;
  readonly service: QueryEndpointService;
  readonly surface: QueryEndpointSurface;
}

export interface QueryModeConfiguration {
  readonly id: string;
  readonly label: string;
  readonly endpoint: string;
  readonly preset: QueryModePreset;
  readonly defaultQuery?: string;
  readonly defaultVariables?: JSONObject;
}

export interface QueryConfiguration extends Omit<Gen3AppConfigData, 'version'> {
  readonly version: 2;
  readonly endpoints: Record<string, QueryEndpointConfiguration>;
  readonly modes: readonly QueryModeConfiguration[];
  readonly defaultMode: string;
}

export interface GqlQueryEditorProps {
  configuration: QueryConfiguration;
  buttons?: React.ReactNode;
}
