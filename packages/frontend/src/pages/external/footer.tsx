import { GetServerSideProps } from 'next';
import React from 'react';
import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import Footer from '../../features/Navigation/Footer/Footer';
import { FooterProps } from '../../features/Navigation';

const StandaloneFooterPage = (props: FooterProps) => {
  return <Footer {...props} />;
};

const loadFooterPage = definePageLoader<PageProps>({
  name: 'ExternalFooter',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});

export const getServerSideProps: GetServerSideProps = async (context) => {
  const result = await loadFooterPage(context);
  if ('props' in result) {
    const props = await result.props;
    return { props: props.footerProps };
  }
  return result;
};

export default StandaloneFooterPage;
