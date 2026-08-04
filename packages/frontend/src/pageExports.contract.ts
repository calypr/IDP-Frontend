import type {
  AnalysisPage,
  AnalysisPageGetServerSideProps,
  AppsPage,
  CalyprPage,
  DataLibraryPage,
  DictionaryPage,
  DiscoveryPage,
  ExplorerPage,
  ExplorerPageGetServerSidePropsForConfigId,
  GitLandingPage,
  LandingPage,
  LoginPage,
  QueryPage,
  QueryPageGetServerSideProps,
  SubmissionPage,
  UploadPage,
  WorkspacePage,
  WorkspacePageGetServerSideProps,
} from './pageExports';

/** Compile-time smoke contract for the supported package page façade. */
export interface PublicPageExportContract {
  AnalysisPage: typeof AnalysisPage;
  AnalysisPageGetServerSideProps: typeof AnalysisPageGetServerSideProps;
  AppsPage: typeof AppsPage;
  CalyprPage: typeof CalyprPage;
  DataLibraryPage: typeof DataLibraryPage;
  DictionaryPage: typeof DictionaryPage;
  DiscoveryPage: typeof DiscoveryPage;
  ExplorerPage: typeof ExplorerPage;
  ExplorerPageGetServerSidePropsForConfigId: typeof ExplorerPageGetServerSidePropsForConfigId;
  GitLandingPage: typeof GitLandingPage;
  LandingPage: typeof LandingPage;
  LoginPage: typeof LoginPage;
  QueryPage: typeof QueryPage;
  QueryPageGetServerSideProps: typeof QueryPageGetServerSideProps;
  SubmissionPage: typeof SubmissionPage;
  UploadPage: typeof UploadPage;
  WorkspacePage: typeof WorkspacePage;
  WorkspacePageGetServerSideProps: typeof WorkspacePageGetServerSideProps;
}
