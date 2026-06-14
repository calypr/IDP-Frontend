import type {
  BuildProjectPresentationDraftArgs,
  ProjectPresentationDraft,
} from './types';

export const buildProjectPresentationDraft = ({
  organization,
  project,
  projectConfig,
  projectRecord,
  projectSummary,
  bodyHTML = '',
}: BuildProjectPresentationDraftArgs): ProjectPresentationDraft => {
  const resolvedTitle =
    projectSummary?.title?.trim() ||
    projectConfig?.project_title?.trim() ||
    projectConfig?.title?.trim() ||
    projectRecord?.title?.trim() ||
    project;

  const resolvedDescription =
    projectSummary?.description?.trim() ||
    projectConfig?.description?.trim() ||
    projectRecord?.description?.trim() ||
    `This project presentation workspace for ${organization}/${project} is ready for an analyst-authored summary, project context, and data access guidance.`;

  const thumbnailURL = projectSummary?.thumbnail_url || projectRecord?.thumbnail_url;

  return {
    hero: {
      title: resolvedTitle,
      summary: resolvedDescription,
      organization,
      project,
      thumbnailURL,
    },
    bodyHTML,
  };
};
