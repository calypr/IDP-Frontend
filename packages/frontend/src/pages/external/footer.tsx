import { GetServerSideProps } from 'next';
import React from 'react';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import Footer from '../../features/Navigation/Footer/Footer';
import { FooterProps } from '../../features/Navigation';

const StandaloneFooterPage = (props: FooterProps) => {
  return <Footer {...props} />;
};

export const getStaticProps: GetServerSideProps = async () => {
  const { footerProps } = await getNavPageLayoutPropsFromConfig();
  return {
    props: {
      ...footerProps,
    },
  };
};

export default StandaloneFooterPage;
