import React from 'react';
import { Menu, UnstyledButton } from '@mantine/core';

import { SessionContext } from '../../lib/session/session';
import { StylingOverrideWithMergeControl } from '../../types';

import { useContext } from 'react';
import { useCoreSelector, selectUserDetails, CoreState } from '@gen3/core';

const UserNavigationMenu = ({
  classNames,
}: {
  classNames: StylingOverrideWithMergeControl;
}) => {
  const { endSession } = useContext(SessionContext) ?? {
    endSession: undefined,
  };
  const userInfo = useCoreSelector((state: CoreState) =>
    selectUserDetails(state),
  );

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <UnstyledButton className={classNames.loginMenu}>
          {userInfo?.username}
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          key={'Profile'}
          onClick={() => {
            window.location.assign('/Profile');
          }}
          className={classNames.button}
        >
          {'Profile'}
        </Menu.Item>
        <Menu.Item
          key={'Logout'}
          onClick={() => endSession?.()}
          className={classNames.button}
        >
          {'Logout'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default UserNavigationMenu;
