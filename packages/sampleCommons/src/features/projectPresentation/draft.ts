import type {
  BuildProjectPresentationDraftArgs,
  ProjectPresentationDraft,
  ProjectPresentationVisualization,
} from './types';

const buildDefaultVisualization = (
  id: string,
  title: string,
  caption: string,
): ProjectPresentationVisualization => ({
  id,
  title,
  caption,
  imageURL: '',
  linkURL: '',
  note: '',
  dataSource: 'manual-placeholder',
  queryRef: '',
  widgetType: 'placeholder',
});

const normalizeHighlight = (value: string): string => value.trim();

export const buildProjectPresentationDraft = ({
  organization,
  project,
  projectConfig,
  projectRecord,
  projectSummary,
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

  const resolvedContact =
    projectSummary?.contact_email?.trim() ||
    projectConfig?.contact_email?.trim() ||
    projectRecord?.contact_email?.trim() ||
    '';

  const thumbnailURL = projectSummary?.thumbnail_url || projectRecord?.thumbnail_url;

  const projectLabel = `${organization}/${project}`;

  return {
    hero: {
      title: resolvedTitle,
      summary: resolvedDescription,
      organization,
      project,
      thumbnailURL,
    },
    overview: [
      `${resolvedTitle} is presented here as a curated research project page for collaborators, reviewers, and data requesters.`,
      `Use this space to explain why the project matters, what the dataset or findings represent, and how outside researchers should evaluate or request access to ${projectLabel}.`,
    ].join('\n\n'),
    highlights: [
      `Project scope: ${resolvedTitle}`,
      `Organization: ${organization}`,
      resolvedContact
        ? `Contact for access or follow-up: ${resolvedContact}`
        : `Add a project contact so requesters know where to start.`,
    ].map(normalizeHighlight),
    visualizations: [
      buildDefaultVisualization(
        'overview-metrics',
        'Project Snapshot',
        'Summarize the primary cohort, dataset, or result this page should foreground.',
      ),
      buildDefaultVisualization(
        'key-finding',
        'Key Finding',
        'Use this space for the one figure or chart that best supports the project story.',
      ),
      buildDefaultVisualization(
        'access-path',
        'Access Path',
        'Explain what data is available, what is controlled, and how others should request access.',
      ),
    ],
    cta: {
      title: 'Request Access or Learn More',
      body: resolvedContact
        ? `Questions about ${resolvedTitle} can be routed to the project contact below while richer data widgets are still being assembled.`
        : `Add a contact and request path so outside collaborators know how to engage with this project.`,
      buttonLabel: 'Request Access',
      buttonURL: `/organization/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`,
      contactEmail: resolvedContact,
    },
  };
};

export const updateVisualizationAtIndex = (
  visualizations: Array<ProjectPresentationVisualization>,
  index: number,
  nextValue: ProjectPresentationVisualization,
): Array<ProjectPresentationVisualization> =>
  visualizations.map((visualization, currentIndex) =>
    currentIndex === index ? nextValue : visualization,
  );
