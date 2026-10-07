import React from 'react';
import { Center } from '@mantine/core';
import { NavPageLayout } from '../../features/Navigation';
import AnalysisPanel from '../../features/Analysis/AnalysisPanel';
import AnalysisCenterWithSections from '../../features/Analysis/AnalysisCenterWithSections';
import type { AnalysisPageProps } from './types';
import { ErrorCard } from '../../components/MessageCards';

const AnalysisPage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
}: AnalysisPageProps): JSX.Element => {
  const tools = configuration && 'tools' in configuration ? configuration.tools : undefined;
  const sections = configuration && 'sections' in configuration ? configuration.sections : undefined;
  const classNames = configuration && 'classNames' in configuration ? configuration.classNames : undefined;
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Analysis Center',
        content: 'Analysis Center',
        key: 'gen3-analysis-center',
      }}
    >
      {!tools && !sections && (
        <Center className="mt-20">
          <ErrorCard message="No tools or sections found" />
        </Center>
      )}
      {tools && <AnalysisPanel tools={tools} />}
      {sections && (
        <AnalysisCenterWithSections
          sections={sections}
          classNames={classNames}
        />
      )}
    </NavPageLayout>
  );
};

export default AnalysisPage;
