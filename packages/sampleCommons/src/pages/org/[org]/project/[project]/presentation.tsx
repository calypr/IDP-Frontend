import {
  ProjectPresentationPage,
  getNavPageLayoutPropsFromConfig,
} from '@gen3/frontend';
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => ({
  props: await getNavPageLayoutPropsFromConfig(),
});

export default ProjectPresentationPage;
