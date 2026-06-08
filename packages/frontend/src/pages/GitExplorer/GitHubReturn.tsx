import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Alert, Button, Container, Stack, Text, Title } from '@mantine/core';
import { NavPageLayout } from '../../features/Navigation';
import type { GitExplorerPageProps } from './types';

const gitHubReturnSignalKey = 'gecko:git-github-return';

const normalizeReturnPath = (value: string | string[] | undefined): string => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') {
    return '/git';
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return '/git';
  }

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//')) {
    return '/git';
  }
  return decoded;
};

const appendGitHubReturnParams = (
  path: string,
  setupAction: string | undefined,
  installationID: string | undefined,
  githubState: string | undefined,
): string => {
  if (!setupAction || !installationID) {
    return path;
  }

  const [pathWithoutHash, hash = ''] = path.split('#', 2);
  const [pathname, queryString = ''] = pathWithoutHash.split('?', 2);
  const params = new URLSearchParams(queryString);
  params.set('setup_action', setupAction);
  params.set('installation_id', installationID);
  if (githubState) {
    params.set('github_state', githubState);
  }
  const nextQueryString = params.toString();
  return `${pathname}${nextQueryString ? `?${nextQueryString}` : ''}${
    hash ? `#${hash}` : ''
  }`;
};

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
  const githubState =
    typeof router.query.state === 'string' ? router.query.state : undefined;
  const returnPath =
    githubState && githubState.startsWith('/')
      ? normalizeReturnPath(githubState)
      : '/git';
  const returnHref = appendGitHubReturnParams(
    returnPath,
    setupAction,
    installationID,
    githubState && !githubState.startsWith('/') ? githubState : undefined,
  );

  useEffect(() => {
    if (!router.isReady || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      gitHubReturnSignalKey,
      JSON.stringify({
        installationID,
        githubState,
        returnPath,
        setupAction,
        timestamp: Date.now(),
      }),
    );
    void router.replace(returnHref);
  }, [
    githubState,
    installationID,
    returnHref,
    returnPath,
    router,
    router.isReady,
    setupAction,
  ]);

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
                and return to the Git page if the redirect does not complete
                automatically.
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
