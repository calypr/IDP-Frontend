import React, { ReactElement, useMemo } from 'react';
import { useCookies } from 'react-cookie';
import {
  type CoreState,
  Modals,
  selectCurrentModal,
  showModal,
  useCoreDispatch,
  useCoreSelector,
  useGetAuthzMappingsQuery,
  useGetCSRFQuery,
} from '@gen3/core';
import { FirstTimeModal } from './FirstTimeModal';
import { SessionExpiredModal } from './SessionExpiredModal';
import { LoginModal } from './LoginModal';
import { ModalsConfig } from './types';
import { defaultComposer } from 'default-composer';
import { ContentType } from '../Content/TextContent';
import { useDeepCompareEffect } from 'use-deep-compare';
import { useIsAuthenticated } from '../../lib/session/session';

interface Gen3StandardModalsProviderProps {
  config: ModalsConfig;
  children: React.ReactNode;
}

const getModal = (
  modal: Modals | string | null,
  config: ModalsConfig,
): ReactElement | null => {
  let res: ReactElement | null = null;
  switch (modal) {
    case Modals.FirstTimeModal: {
      res = config.systemUseModal?.enabled ? (
        <FirstTimeModal openModal={true} config={config.systemUseModal} />
      ) : null;
      break;
    }
    case Modals.SessionExpireModal: {
      res = (
        <SessionExpiredModal
          openModal={true}
          config={config.sessionExpiredModal}
        />
      );
      break;
    }
    case (Modals as any).LoginModal: {
      res = <LoginModal openModal={true} />;
      break;
    }
  }
  return res;
};
const defaultConfig: ModalsConfig = {};

const Gen3ModalsProvider = ({
  config,
  children,
}: Gen3StandardModalsProviderProps) => {
  const { isAuthenticated } = useIsAuthenticated();
  // TODO: move this to another
  const { isError } = useGetCSRFQuery(undefined, { refetchOnFocus: true });
  useGetAuthzMappingsQuery(undefined, { skip: !isAuthenticated });

  const [cookie] = useCookies(['Gen3-first-time-use']);
  const dispatch = useCoreDispatch();
  const modal = useCoreSelector((state: CoreState) =>
    selectCurrentModal(state),
  );

  const modalsConfig = useMemo(
    () => defaultComposer(defaultConfig, config),
    [config],
  );
  useDeepCompareEffect(() => {
    if (
      !cookie['Gen3-first-time-use'] &&
      modalsConfig.systemUseModal?.enabled
    ) {
      if (modalsConfig.systemUseModal?.showOnlyOnLogin && !isAuthenticated)
        return;
      if (dispatch) dispatch(showModal({ modal: Modals.FirstTimeModal }));
    }
  }, [
    cookie['Gen3-first-time-use'],
    dispatch,
    modalsConfig.systemUseModal?.enabled,
  ]);

  if (isError) {
    return (
      <div className="w-full m-20">
        Error Getting status check from commons.
      </div>
    );
  }

  return (
    <div className="bg-base-max">
      {modal && getModal(modal, modalsConfig)}
      {children}
    </div>
  );
};

export default Gen3ModalsProvider;
