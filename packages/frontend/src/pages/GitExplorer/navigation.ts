import type { NextRouter } from 'next/router';

/**
 * Git explorer pages intentionally use a full document navigation. The tree
 * path is part of the page URL, and remounting the page keeps browser history,
 * SSR, and query-derived state consistent across browsers.
 */
export const hardNavigate = (
  router: Pick<NextRouter, 'basePath'>,
  href: string,
) => {
  window.location.assign(`${router.basePath ?? ''}${href}`);
};
