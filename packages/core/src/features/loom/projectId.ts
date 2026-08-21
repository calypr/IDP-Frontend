/** Canonical project identity shared by Loom Explorer API callers. */
export const canonicalLoomProjectId = (project: string): string => {
  let normalized = project.trim();
  if (!normalized) return normalized;
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the original value; the server will return a precise route error.
  }
  normalized = normalized.replace(/^\/+|\/+$/g, '');
  if (normalized.includes('/')) {
    const [program, ...projectParts] = normalized.split('/');
    return program && projectParts.join('/')
      ? `${program}/${projectParts.join('/')}`
      : normalized;
  }
  const legacySeparator = normalized.indexOf('-');
  if (legacySeparator > 0 && legacySeparator < normalized.length - 1) {
    return `${normalized.slice(0, legacySeparator)}/${normalized.slice(legacySeparator + 1)}`;
  }
  return `HTAN_INT/${normalized}`;
};

/**
 * Encode the canonical project identity for Loom's `/projects/:project`
 * path segment.
 *
 * The local public reverse proxy decodes one percent-encoding layer before
 * forwarding the request. Encoding twice keeps the slash inside the project
 * identity from becoming a second URL path segment at the proxy boundary;
 * Loom receives the canonical `program/project` value after its normal path
 * decoding.
 */
export const encodeLoomProjectPath = (project: string): string =>
  encodeURIComponent(encodeURIComponent(canonicalLoomProjectId(project)));

export const legacyLoomProjectId = (project: string): string => {
  const canonical = canonicalLoomProjectId(project);
  const separator = canonical.indexOf('/');
  return separator > 0
    ? `${canonical.slice(0, separator)}-${canonical.slice(separator + 1)}`
    : canonical;
};
