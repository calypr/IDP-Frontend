import { Menu, UnstyledButton } from '@mantine/core';

import { SessionContext } from '../../lib/session/session';

import { useContext } from 'react';
import { useRouter } from 'next/router';
import { useCoreSelector, selectUserDetails, CoreState } from '@gen3/core';

const UserNavigationMenu = () => {
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
          <div className="flex flex-nowrap items-center text-white align-middle border-b-2 hover:border-accent border-transparent">
            {userInfo?.username}
          </div>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          key={'profile'}
          onClick={() => router.push('/Profile')}
          className="hover:text-accent-light"
        >
          {'profile'}
        </Menu.Item>
        <Menu.Item
          key={'logout'}
          onClick={() => endSession && endSession() && router.push('/')}
          className="hover:text-accent-light"
        >
          {'logout'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default UserNavigationMenu;
