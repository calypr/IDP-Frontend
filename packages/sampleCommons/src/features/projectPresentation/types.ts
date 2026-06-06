import type {
  GeckoProjectConfig,
  GeckoProjectRecord,
  GeckoProjectSummaryRecord,
} from '@gen3/core';

export interface ProjectPresentationHero {
  title: string;
  summary: string;
  organization: string;
  project: string;
  thumbnailURL?: string;
}

export interface ProjectPresentationVisualization {
  id: string;
  title: string;
  caption: string;
  imageURL: string;
  linkURL: string;
  note: string;
  queryRef?: string;
  widgetType?: string;
  dataSource?: string;
}

export interface ProjectPresentationCTA {
  title: string;
  body: string;
  buttonLabel: string;
  buttonURL: string;
  contactEmail: string;
}

export interface ProjectPresentationDraft {
  hero: ProjectPresentationHero;
  overview: string;
  highlights: Array<string>;
  visualizations: Array<ProjectPresentationVisualization>;
  cta: ProjectPresentationCTA;
}

export interface BuildProjectPresentationDraftArgs {
  organization: string;
  project: string;
  projectConfig?: GeckoProjectConfig;
  projectRecord?: GeckoProjectRecord;
  projectSummary?: GeckoProjectSummaryRecord;
}
