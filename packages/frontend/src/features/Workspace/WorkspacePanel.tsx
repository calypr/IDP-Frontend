import React from 'react';
import { Center, Grid, LoadingOverlay, rem, Transition } from '@mantine/core';
import {
  useGetWorkspaceOptionsQuery,
  useGetWorkspaceStatusQuery,
  WorkspaceInfo,
  WorkspaceStatus,
} from '@gen3/core';
import { ErrorCard } from '../../components/MessageCards';
import NotebookCard from './NotebookCard';
import { WORKSPACES_ENABLED } from './config';

const WorkspacePanel = () => {
  const { data, isLoading, isError } = useGetWorkspaceOptionsQuery(undefined, {
    skip: !WORKSPACES_ENABLED,
  });

  const { data: workspaceStatusData } = useGetWorkspaceStatusQuery(undefined, {
    skip: !WORKSPACES_ENABLED,
  });

  if (!WORKSPACES_ENABLED) {
    return null;
  }

  if (isError) {
    return (
      <Center>
        <ErrorCard message="Error loading workspace definitions" />
      </Center>
    );
  }

  const workspaceStatus = workspaceStatusData?.status;
  return (
    <>
      <Transition
        mounted={
          workspaceStatus === WorkspaceStatus.NotFound ||
          workspaceStatus === WorkspaceStatus.Launching
        }
        transition="scale-y"
        duration={600}
        exitDuration={600}
        timingFunction="ease"
      >
        {(styles) => (
          <div className="px-2 mt-4" style={styles}>
            <LoadingOverlay visible={isLoading} />
            <Grid
              justify="center"
              align="stretch"
              gutter="sm"
              overflow="hidden"
            >
              {data?.map((card: WorkspaceInfo) => {
                return (
                  <Grid.Col
                    key={card.id}
                    span="content"
                    style={{ minHeight: rem(150) }}
                  >
                    <NotebookCard info={card} />
                  </Grid.Col>
                );
              })}
            </Grid>
          </div>
        )}
      </Transition>
    </>
  );
};

export default WorkspacePanel;
