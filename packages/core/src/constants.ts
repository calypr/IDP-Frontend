export const GEN3_COMMONS_NAME =
  process.env.NEXT_PUBLIC_GEN3_COMMONS_NAME || 'cbds';
export const GEN3_API = process.env.NEXT_PUBLIC_GEN3_API || '';
export const GEN3_DOMAIN = process.env.NEXT_PUBLIC_GEN3_DOMAIN || '';
export const GUID_PREFIX_PATTERN = /^dg.[a-zA-Z0-9]+\//;

/**
 *  Service Specific Constants
 */
export const GEN3_GUPPY_API =
  process.env.NEXT_PUBLIC_GEN3_GUPPY_API || `${GEN3_API}/guppy`;
export const GEN3_LOOM_API =
  process.env.NEXT_PUBLIC_GEN3_LOOM_API || `${GEN3_API}/loom`;
export const GEN3_MDS_API =
  process.env.NEXT_PUBLIC_GEN3_MDS_API || `${GEN3_API}/mds`;
export const GEN3_DOWNLOADS_ENDPOINT =
  process.env.NEXT_PUBLIC_GEN3_DOWNLOADS_ENDPOINT || 'downloads';
export const GEN3_FENCE_API =
  process.env.NEXT_PUBLIC_GEN3_FENCE_API || `${GEN3_API}/user`;
export const SYFON_API =
  process.env.NEXT_PUBLIC_SYFON_API ||
  process.env.NEXT_PUBLIC_GEN3_SYFON_API ||
  `${GEN3_API}/data`;
export const SYFON_DRS_API =
  process.env.NEXT_PUBLIC_SYFON_DRS_API ||
  process.env.NEXT_PUBLIC_GEN3_SYFON_DRS_API ||
  `${GEN3_API}/ga4gh/drs/v1`;
export const GEN3_AI_SEARCH_API =
  process.env.NEXT_PUBLIC_GEN3_AI_SEARCH_API || `${GEN3_API}/ai-search`;
export const GEN3_AUTHZ_API =
  process.env.NEXT_PUBLIC_GEN3_AUTHZ_API || `${GEN3_API}/authz`;
export const GEN3_REDIRECT_URL =
  process.env.NEXT_PUBLIC_GEN3_REDIRECT_URL || GEN3_API;
export const GEN3_WORKSPACE_API =
  process.env.NEXT_PUBLIC_GEN3_WORKSPACE_STATUS_API ||
  `${GEN3_API}/lw-workspace`;
export const GEN3_SUBMISSION_API =
  process.env.NEXT_PUBLIC_GEN3_SUBMISSION_API ||
  `${GEN3_API}/api/v0/submission`;
export const GEN3_WTS_API =
  process.env.NEXT_PUBLIC_GEN3_WTS_API || `${GEN3_API}/wts`;
export const GEN3_DATA_LIBRARY_API =
  process.env.NEXT_PUBLIC_GEN3_DATA_LIBRARY_API || `${GEN3_API}/library/lists`;
export const GEN3_CROSSWALK_API =
  process.env.NEXT_PUBLIC_GEN3_CROSSWALK_API || `${GEN3_API}/mds`;
export const GEN3_SOWER_API =
  process.env.NEXT_PUBLIC_GEN3_SOWER_API || `${GEN3_API}/jobs`;
export const GEN3_MANIFEST_API =
  process.env.NEXT_PUBLIC_GEN3_MANIFEST_API || `${GEN3_API}/manifests`;
export const GEN3_REQUESTOR_API =
  process.env.NEXT_PUBLIC_GEN3_REQUESTOR_API || `${GEN3_API}/requestor`;
export const GEN3_GRIP_API =
  process.env.NEXT_PUBLIC_GEN3_GRIP_API || `${GEN3_API}/grip`;
export const DIR_SEARCH_API =
  process.env.NEXT_PUBLIC_GEN3_DIR_API || `${GEN3_API}/Dir`;
export const CALYPR_EXPLORER_CONFIG_API =
  process.env.NEXT_PUBLIC_GEN3_CONFIG_API || `${GEN3_API}/gecko`;
export const GEN3_GECKO_API =
  process.env.NEXT_PUBLIC_GEN3_GECKO_API || `${GEN3_API}/api`;

export enum Accessibility {
  ACCESSIBLE = 'accessible',
  UNACCESSIBLE = 'unaccessible',
  ALL = 'all',
}

export const FILE_FORMATS = {
  JSON: 'json',
  TSV: 'tsv',
  CSV: 'csv',
};

export const FILE_DELIMITERS = {
  tsv: '\t',
  csv: ',',
};
