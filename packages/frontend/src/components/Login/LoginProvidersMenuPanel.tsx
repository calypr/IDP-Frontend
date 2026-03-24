import React from 'react';
import { Loader, Menu, UnstyledButton } from '@mantine/core';
import {
  type Gen3LoginProvider,
  type NameUrl,
  useGetLoginProvidersQuery,
} from '@gen3/core';
import { LoginSelectedProps } from './types';
import { StylingOverrideWithMergeControl } from '../../types';

const LoginProviderMultipleItemsMenu = ({
  classNames,
  providers,
  handleLoginSelected,
  zIndex,
}: {
  classNames: StylingOverrideWithMergeControl;
  providers: Gen3LoginProvider[];
  handleLoginSelected: (url: string) => void;
  zIndex?: number;
}) => {
  return (
    <Menu shadow="xl" width={280} zIndex={zIndex} transitionProps={{ transition: 'pop-top-right' }}>
      <Menu.Target>
        <UnstyledButton className={classNames.button}>
          <div className={classNames.label}>Login</div>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Provider Options</Menu.Label>
        <Menu.Divider />

        {providers.map((provider: Gen3LoginProvider) =>
          provider.urls.map((item: NameUrl) => (
            <Menu.Item
              key={`${provider.name}-${item.url}`}
              onClick={() => handleLoginSelected(item.url)}
              className={classNames.dropdownItem ?? 'font-medium text-gray-700 hover:bg-gray-50 transition-colors py-2 px-4'}
            >
              {provider.name}
            </Menu.Item>
          )),
        )}
      </Menu.Dropdown>
    </Menu>
  );
};

const LoginProvidersMenuPanel = ({
  handleLoginSelected,
  classNames,
  zIndex,
}: LoginSelectedProps) => {
  const { data, isSuccess } = useGetLoginProvidersQuery();

  if (!isSuccess) {
    return <Loader />;
  }

  return (
    <div className="flex justify-center">
      <LoginProviderMultipleItemsMenu
        classNames={classNames ?? {}}
        providers={data?.providers}
        handleLoginSelected={handleLoginSelected}
        zIndex={zIndex}
      />
    </div>
  );
};

export default LoginProvidersMenuPanel;
