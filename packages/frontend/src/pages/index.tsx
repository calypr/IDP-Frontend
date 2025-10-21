import React from 'react';
import { GetServerSideProps } from 'next';
import { Header, Footer } from '../features/Navigation';
import { HeaderToggleProps } from '../features/Navigation/types';

const IndexPage = ({
  top,
  navigation,
  basePage,
  leftnav,
  onToggle,
}: HeaderToggleProps) => {
  return (
    <div className="flex flex-col">
      <Header
        top={top}
        navigation={navigation}
        title=""
        basePage={basePage}
        leftnav={leftnav}
        onToggle={onToggle}
      />
      <div className="flex flex-row  justify-items-center">
        <div className="sm:prose-base lg:prose-lg xl:prose-xl 2xl:prose-xl mx-20"></div>
      </div>
      <Footer basePage={basePage} />
    </div>
  );
};

// todo

const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/landing',
      permanent: false,
    },
  };
};

export default IndexPage;
