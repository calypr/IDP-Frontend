import { Menu, UnstyledButton } from '@mantine/core';

import { SessionContext } from '../../lib/session/session';
import { StylingOverrideWithMergeControl } from '../../types';

import { useContext } from 'react';
import { useRouter } from 'next/router';
import { useCoreSelector, selectUserDetails, CoreState } from '@gen3/core';

const UserNavigationMenu = ({
  classNames,
}: {
  classNames: StylingOverrideWithMergeControl;
}) => {
  const { endSession } = useContext(SessionContext) ?? {
    endSession: undefined,
  };
  const router = useRouter();
  const userInfo = useCoreSelector((state: CoreState) =>
    selectUserDetails(state),
  );

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <UnstyledButton className="mx-2">
          <div className={classNames.label}>{userInfo?.username}</div>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          key={'profile'}
          onClick={() => router.push('/Profile')}
          className={classNames.button}
        >
          {'profile'}
        </Menu.Item>
        <Menu.Item
          key={'logout'}
          onClick={() => endSession && endSession() && router.push('/')}
          className={classNames.button}
        >
          {'logout'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default UserNavigationMenu;
