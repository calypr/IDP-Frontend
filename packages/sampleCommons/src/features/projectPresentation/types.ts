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

export interface ProjectPresentationDraft {
  hero: ProjectPresentationHero;
  bodyHTML: string;
}

export interface BuildProjectPresentationDraftArgs {
  organization: string;
  project: string;
  projectConfig?: GeckoProjectConfig;
  projectRecord?: GeckoProjectRecord;
  projectSummary?: GeckoProjectSummaryRecord;
  bodyHTML?: string;
}
