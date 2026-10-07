import { GEN3_COMMONS_NAME } from '@gen3/core';
import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { type ReportsPageProps } from './types';
import { ReportsConfigurationSchema } from './configurationSchema';

const loadReportsPage = (id: string, filepath: string) =>
  definePageLoader<ReportsPageProps>({
    name: id,
    loadNavigation: loadNavigationFromContext,
    load: async (context) => ({
      configuration: (await context.config.load({
        id,
        source: 'content',
        resolvePath: () => `${GEN3_COMMONS_NAME}/${filepath}`,
        schema: ReportsConfigurationSchema,
      })) as unknown as ReportsPageProps['configuration'],
    }),
    fallback: () => ({ configuration: null }),
  });

export const RSReportsPageGetServerSideProps = loadReportsPage(
  'reports.researchsubject',
  'reports/researchsubject.json',
);

export const SpecimenReportsPageGetServerSideProps = loadReportsPage(
  'reports.specimen',
  'reports/specimen.json',
);
export const MAReportsPageGetServerSideProps = loadReportsPage(
  'reports.medicationadministration',
  'reports/medicationadministration.json',
);
