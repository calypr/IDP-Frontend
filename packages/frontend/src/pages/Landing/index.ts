export { default, default as LandingPage } from './Landing';
export {
  default as AboutUsPage,
  getServerSideProps as AboutUsPageGetServerSideProps,
} from './about-us';
export {
  default as ContactPage,
  getServerSideProps as ContactPageGetServerSideProps,
} from './contact';
export {
  default as ResourcePage,
  getServerSideProps as ResourcePageGetServerSideProps,
} from './resource';
export type * from './types';
export { LandingPageGetServerSideProps } from './data';
