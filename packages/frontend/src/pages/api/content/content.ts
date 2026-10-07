import { NextApiRequest, NextApiResponse } from 'next';
import { createServerPageContext } from '../../../lib/pageLoader';
import { loadNavigationFromContext } from '../../../lib/common/staticProps';

export default async function (req: NextApiRequest, res: NextApiResponse) {
  // This is an API handler, not a Next page loader, so it must preserve its
  // JSON response contract instead of returning page props through Next.
  const context = createServerPageContext(
    { req, res, query: {}, resolvedUrl: req.url ?? '' } as any,
    loadNavigationFromContext,
  );
  const content = await context.loadNavigation();
  return res.status(200).json({
    content,
  });
}
