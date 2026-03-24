import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type BrowserProps, type BrowserPageProps } from './types';

export const BrowserPageGetServerSideProps: GetServerSideProps<
  BrowserPageProps
> = async (context) => {
  const cookieHeader = context.req.headers.cookie;
  const requestHeaders: Record<string, string> = {};
  if (cookieHeader) {
    requestHeaders['Cookie'] = cookieHeader;
  }
  try {
    const browserConfig: BrowserProps =
      await ContentSource.getContentDatabase().get(
        `${GEN3_COMMONS_NAME}/millerPage.json`,
      );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        ...browserConfig,
      },
    };
  } catch (err: any) {
    const status = err?.status || 500;
    context.res.statusCode = status;
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        errorStatus: status,
      },
    };
  }
};
