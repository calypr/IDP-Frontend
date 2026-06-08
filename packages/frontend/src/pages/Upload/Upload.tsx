import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import { Upload as UploadFeature } from '../../features/Upload';
import { UploadPageProps } from './types';

const UploadPage = ({
  headerProps,
  footerProps,
}: UploadPageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ footerProps, headerProps }}
      headerMetadata={{
        title: 'Gen3 Upload Page',
        content: 'Upload page',
        key: 'gen3-upload-page',
      }}
    >
      <UploadFeature />
    </NavPageLayout>
  );
};

export default UploadPage;
