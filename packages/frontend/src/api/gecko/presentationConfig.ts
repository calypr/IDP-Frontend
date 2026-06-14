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

const presentationConfigURL = (
  req: NextApiRequest,
  organization: string,
  project: string,
): string => {
  const baseURL = GEN3_API || requestOrigin(req);
  return `${baseURL}/gecko/git/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/presentationConfig`;
};

const extractHTMLFromBody = (body: unknown): string => {
  if (typeof body === 'string') {
    return body;
  }

  if (body && typeof body === 'object') {
    const candidate = body as {
      presentationConfig?: unknown;
    };
    if (typeof candidate.presentationConfig === 'string') {
      return candidate.presentationConfig;
    }
  }

  return '';
};

const proxyRequestHeaders = (req: NextApiRequest) => ({
  ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
  ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
});

export default async function presentationConfig(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const organization = Array.isArray(req.query.organization)
    ? req.query.organization[0]
    : req.query.organization;
  const project = Array.isArray(req.query.project)
    ? req.query.project[0]
    : req.query.project;

  if (!organization || !project) {
    return res.status(400).json({ error: 'Missing organization or project.' });
  }

  if (req.method === 'GET') {
    try {
      const upstream = await fetch(
        presentationConfigURL(req, organization, project),
        {
          headers: proxyRequestHeaders(req),
          method: 'GET',
        },
      );

      if (upstream.status === 404 || upstream.status === 204) {
        res.setHeader('Cache-Control', defaultCacheControl);
        return res.status(200).json({ data: '', success: true });
      }

      const rawBody = await upstream.text();

      if (!upstream.ok) {
        res.setHeader(
          'Cache-Control',
          upstream.headers.get('cache-control') || defaultCacheControl,
        );
        return res.status(upstream.status).send(rawBody);
      }

      res.setHeader(
        'Cache-Control',
        upstream.headers.get('cache-control') || defaultCacheControl,
      );
      return res.status(200).send(rawBody);
    } catch (error) {
      return res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch presentation config.',
      });
    }
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const html = extractHTMLFromBody(req.body);
      const upstream = await fetch(
        presentationConfigURL(req, organization, project),
        {
          body: JSON.stringify({ presentationConfig: html }),
          headers: {
            ...proxyRequestHeaders(req),
            'content-type': 'application/json',
          },
          method: req.method,
        },
      );

      const rawBody = await upstream.text();

      if (!upstream.ok) {
        res.setHeader(
          'Cache-Control',
          upstream.headers.get('cache-control') || defaultCacheControl,
        );
        return res.status(upstream.status).send(rawBody);
      }

      res.setHeader('Cache-Control', upstream.headers.get('cache-control') || defaultCacheControl);
      return res.status(200).send(rawBody);
    } catch (error) {
      return res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update presentation config.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT');
  return res.status(405).json({ error: 'Method not allowed.' });
}
