import React, { useCallback } from 'react';
import {
  selectUserDetails,
  useCoreDispatch,
  useCoreSelector,
  type CoreState,
} from '@gen3/core';
import {
  LoomSavedViewBuilder,
  type LoomSavedViewBuilderProps,
} from '@calypr/loom-ui/saved-views';
import '@calypr/loom-ui/styles.css';
import { useAuthenticatedLoomClient } from './authenticatedLoomClient';
import { invalidateProjectViewBuilder } from './projectViewBuilderApi';

export type ExplorerViewBuilderProps = Omit<LoomSavedViewBuilderProps, 'client'>;

export const ExplorerViewBuilder = (props: ExplorerViewBuilderProps) => {
  const user = useCoreSelector((state: CoreState) => selectUserDetails(state));
  const principal =
    user.sub ?? user.username ?? user.email ?? String(user.id ?? 'anonymous');
  return <AuthenticatedExplorerViewBuilder key={principal} {...props} />;
};

const AuthenticatedExplorerViewBuilder = (props: ExplorerViewBuilderProps) => {
  const client = useAuthenticatedLoomClient();
  const dispatch = useCoreDispatch();
  const onSaved = useCallback(() => {
    dispatch(
      invalidateProjectViewBuilder(props.project),
    );
  }, [dispatch, props.project]);
  return <LoomSavedViewBuilder {...props} client={client} onSaved={onSaved} />;
};
