import React from 'react';
import {
  NavPageLayout,
  ProtectedContent,
  NavPageLayoutProps,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

import { Card, Text } from '@mantine/core';

const discoveryData = {
  data: {
    _aggregation: {
      discovery: {
        _totalCount: 6,
      },
    },
    discovery: [
      {
        project: 'SMMART',
        pi: 'Gordon Mills',
        stakeholders: 'Allison Creason',
        location: 'Internal',
        description: 'Support for SMMART precision oncology',
      },
      {
        project: 'TCGA-LUAD',
        pi: 'Kyle Ellrott',
        stakeholders: 'Kyle Ellrott, Elisabeth Goldman',
        location: 'Internal',
        description: 'Discovery dataset for lung cancer health disparities',
      },
      {
        project: 'TCGA-ESCA',
        pi: 'Kyle Ellrott',
        location: 'Internal',
        stakeholders: 'Kyle Ellrott, Elisabeth Goldman',
      },
      {
        project: 'GDAN-MILD',
        pi: 'Kyle Ellrott',
        location: 'Internal',
        stakeholders: 'Kyle Ellrott, Jordan Lee',
      },
      {
        project: 'Prostate-CEDAR',
        pi: 'Ece Eksi',
        location: 'Internal',
      },
      {
        project: 'PDAC-HTAN',
        location: 'Internal/External',
        pi: 'Rosie Sears',
      },
    ],
  },
};

interface discoveryElem {
  project?: string;
  pi?: string;
  location?: string;
  stakeholders?: string;
  description?: string;
}

const DiscoveryBannerCard = ({
  project,
  pi,
  location,
  stakeholders,
  description,
}: discoveryElem) => {
  return (
    <Card shadow="md" className="flex flex-col rounded-lg bg-white">
      <div className="flex flex-col space-y-4">
        <Text className="text-xl font-semibold text-gray-800">{project}</Text>
        {Object.entries({
          PI: pi,
          Location: location,
          Stakeholders: stakeholders,
          Description: description,
        }).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <Text className="font-semibold text-gray-600">{key}:</Text>
            <Text className="text-gray-800">{value}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
};
const DiscoveryPage = ({ headerProps, footerProps, pageProblems }: NavPageLayoutProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'CALYPR Discovery Page',
        content: 'Discovery Page',
        key: 'discovery-page',
      }}
    >
      <ProtectedContent>
        <div className="flex flex-col justify-center p-6">
          <div className="pt-10 pb-3 text-3xl font-bold text-black">
            Discover New Projects
          </div>
          <div className="flex flex-col justify-center gap-6">
            {discoveryData?.data.discovery.map(
              (disc: discoveryElem, index: number) => (
                <DiscoveryBannerCard key={index} {...disc} />
              ),
            )}
          </div>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export const getServerSideProps = defineSamplePageLoader('Discovery');

export default DiscoveryPage;
