import type { NextApiRequest, NextApiResponse } from 'next';

type HealthResponse = {
  status: 'ok';
};

export default function healthz(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse>,
) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok' });
}
