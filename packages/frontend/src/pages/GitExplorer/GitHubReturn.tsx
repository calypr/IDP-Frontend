import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Alert, Button, Container, Stack, Text, Title } from '@mantine/core';
import { NavPageLayout } from '../../features/Navigation';
import type { GitExplorerPageProps } from './types';

const gitHubReturnSignalKey = 'gecko:git-github-return';

const GitHubReturnPage = ({
  headerProps,
  footerProps,
}: GitExplorerPageProps) => {
  const router = useRouter();
  const setupAction =
    typeof router.query.setup_action === 'string'
      ? router.query.setup_action
      : undefined;
  const installationID =
    typeof router.query.installation_id === 'string'
      ? router.query.installation_id
      : undefined;
  const returnHref =
    setupAction === 'update' && installationID
      ? `/git?setup_action=${encodeURIComponent(setupAction)}&installation_id=${encodeURIComponent(installationID)}`
      : '/git';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      gitHubReturnSignalKey,
      JSON.stringify({
        installationID,
        setupAction,
        timestamp: Date.now(),
      }),
    );
  }, [installationID, setupAction]);

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: 'GitHub connection return',
        key: 'gecko-git-github-return',
        title: 'GitHub Connection Return',
      }}
      mainProps={{ className: 'bg-[#f4f6f8]' }}
    >
      <div className="min-h-screen bg-[#f4f6f8] py-12">
        <Container maw={720}>
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <Stack gap="md">
              <Title order={2}>GitHub configuration updated</Title>
              <Text c="dimmed">
                Caliper has received the GitHub response. You can close this tab
                and return to the Git page.
              </Text>
              <Alert color="blue" variant="light">
                The main Git page will refresh connection state automatically.
              </Alert>
              <div className="flex flex-wrap gap-3">
                <Button component="a" href={returnHref} variant="light">
                  Return to Git page
                </Button>
                <Button
                  onClick={() => {
                    window.close();
                  }}
                  variant="subtle"
                >
                  Close tab
                </Button>
              </div>
            </Stack>
          </div>
        </Container>
      </div>
    </NavPageLayout>
  );
};

export default GitHubReturnPage;
