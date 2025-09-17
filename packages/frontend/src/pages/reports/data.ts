import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type ReportsPageProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const RSReportsPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const reportsConfig: ReportsPageProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/reports/researchsubject.json`,
    );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      reportsConfig: reportsConfig ? reportsConfig : null,
    },
  };
};

export const SpecimenReportsPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const reportsConfig: ReportsPageProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/reports/specimen.json`,
    );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      reportsConfig: reportsConfig ? reportsConfig : null,
    },
  };
};
export const MAReportsPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const reportsConfig: ReportsPageProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/reports/medicationadministration.json`,
    );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      reportsConfig: reportsConfig ? reportsConfig : null,
    },
  };
};
