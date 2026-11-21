import {
  ProjectPresentationEditPage,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

export const getServerSideProps = defineSamplePageLoader('ProjectPresentationEdit');

export default ProjectPresentationEditPage;
