import React from 'react';
import {
  NavPageLayout,
  ProtectedContent,
  getNavPageLayoutPropsFromConfig,
  NavPageLayoutProps,
  MatchingTable,
} from '@gen3/frontend';

import { GetServerSideProps } from 'next';

const discoverytableConfig = {
  Project: {
    title: 'Project',
    field: 'Project',
  },
  PI: {
    title: 'Principal Investigator',
    field: 'PI',
  },
  Stakeholders: {
    title: 'Stakeholders',
    field: 'Stakeholders',
  },
  Location: {
    title: 'Location',
    field: 'Location',
  },
  Description: {
    title: 'Description',
    field: 'Description',
  },
};

const discoveryData = {
  data: {
    _aggregation: {
      discovery: {
        _totalCount: 6,
      },
    },
    discovery: [
      {
        Project: 'SMMART',
        PI: 'Gordon Mills',
        Stakeholders: 'Allison Creason',
        Location: 'Internal',
        Description: 'Support for SMMART precision oncology',
      },
      {
        Project: 'TCGA-LUAD',
        PI: 'Kyle Ellrott',
        Stakeholders: 'Kyle Ellrott, Elisabeth Goldman',
        Location: 'Internal',
        Description: 'Discovery dataset for lung cancer health disparities',
      },
      {
        Project: 'TCGA-ESCA',
        PI: 'Kyle Ellrott',
        Location: 'Internal',
        Stakeholders: 'Kyle Ellrott, Elisabeth Goldman',
      },
      {
        Project: 'GDAN-MILD',
        PI: 'Kyle Ellrott',
        Location: 'Internal',
        Stakeholders: 'Kyle Ellrott, Jordan Lee',
      },
      {
        Project: 'Prostate-CEDAR',
        PI: 'Ece Eksi',
        Location: 'Internal',
      },
      {
        Project: 'PDAC-HTAN',
        Location: 'Internal/External',
        PI: 'Rosie Sears',
      },
    ],
  },
};
const DiscoveryPage = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Discovery Page',
        content: 'Discovery Page',
        key: 'discovery-page',
      }}
    >
      <ProtectedContent>
        <div className="flex justify-center w-screen">
          <div className="col-span-2 m-6">
            <div className="pt-10 pb-3 text-3xl font-bold text-black">
              Discover New Projects
            </div>
            <div className="grid">
              <MatchingTable
                isLoading={false}
                columns={discoverytableConfig ?? {}}
                index={'discovery'}
                idField={''}
                data={discoveryData}
              />
            </div>
          </div>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default DiscoveryPage;
