import {
  ProjectPresentationPage,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

export const getServerSideProps = defineSamplePageLoader('ProjectPresentation');

export default ProjectPresentationPage;
