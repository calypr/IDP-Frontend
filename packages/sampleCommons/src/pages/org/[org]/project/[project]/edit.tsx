import React from 'react';
import {
  getNavPageLayoutPropsFromConfig,
  NavPageLayout,
  ProtectedContent,
} from '@gen3/frontend';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

const ProjectEditPage = ({
  headerProps,
  footerProps,
}: Awaited<ReturnType<typeof getNavPageLayoutPropsFromConfig>>) => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';

  return (
    <ProtectedContent>
      <NavPageLayout
        {...{ headerProps, footerProps }}
        headerMetadata={{
          title: 'Project Page Editor',
          content: 'Project page editor',
          key: 'project-page-editor',
        }}
      >
        <div className="px-8 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">
              {organization}/{project}
            </h1>
            <p className="mt-4 text-sm text-slate-600">
              This low-code page editor is intentionally blank for now.
            </p>
          </div>
        </div>
      </NavPageLayout>
    </ProtectedContent>
  );
};

export const getServerSideProps: GetServerSideProps = async () => ({
  props: await getNavPageLayoutPropsFromConfig(),
});

export default ProjectEditPage;
