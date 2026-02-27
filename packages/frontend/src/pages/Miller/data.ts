import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type MillerProps, type MillerPageProps } from './types';

export const MillerPageGetServerSideProps: GetServerSideProps<
  MillerPageProps
> = async (context) => {
  const cookieHeader = context.req.headers.cookie;
  const requestHeaders: Record<string, string> = {};
  if (cookieHeader) {
    requestHeaders['Cookie'] = cookieHeader;
  }
  try {
    const millerConfig: MillerProps =
      await ContentSource.getContentDatabase().get(
        `${GEN3_COMMONS_NAME}/millerPage.json`,
      );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        ...millerConfig,
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
