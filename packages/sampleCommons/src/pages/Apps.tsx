import { GetServerSideProps } from 'next';

const LegacyAppsPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/',
    permanent: false,
  },
});

export default LegacyAppsPage;
