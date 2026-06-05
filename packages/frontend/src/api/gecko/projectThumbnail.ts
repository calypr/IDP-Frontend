import type { NextApiRequest, NextApiResponse } from 'next';

const GEN3_API = process.env.NEXT_PUBLIC_GEN3_API || '';
const defaultCacheControl = 'private, max-age=60, stale-while-revalidate=300';

const requestOrigin = (req: NextApiRequest): string => {
  const protocolHeader = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : protocolHeader || 'http';
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return host ? `${protocol}://${host}` : '';
};

const geckoThumbnailURL = (
  req: NextApiRequest,
  organization: string,
  project: string,
): string => {
  const baseURL = GEN3_API || requestOrigin(req);
  return `${baseURL}/gecko/git/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/thumbnail`;
};

export default async function projectThumbnail(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const organization = Array.isArray(req.query.organization)
    ? req.query.organization[0]
    : req.query.organization;
  const project = Array.isArray(req.query.project)
    ? req.query.project[0]
    : req.query.project;

  if (!organization || !project) {
    return res.status(400).json({ error: 'Missing organization or project.' });
  }

  try {
    const upstream = await fetch(geckoThumbnailURL(req, organization, project), {
      headers: {
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {}),
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
      },
      method: 'GET',
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      res.setHeader(
        'Cache-Control',
        upstream.headers.get('cache-control') || defaultCacheControl,
      );
      return res.status(upstream.status).send(body);
    }

    const contentType = upstream.headers.get('content-type') || 'image/*';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader(
      'Cache-Control',
      upstream.headers.get('cache-control') || defaultCacheControl,
    );

    const etag = upstream.headers.get('etag');
    if (etag) {
      res.setHeader('ETag', etag);
    }

    const lastModified = upstream.headers.get('last-modified');
    if (lastModified) {
      res.setHeader('Last-Modified', lastModified);
    }

    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch project thumbnail.',
    });
  }
}
