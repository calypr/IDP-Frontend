import { LoadingOverlay, Menu, UnstyledButton } from '@mantine/core';
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
}: {
  classNames: StylingOverrideWithMergeControl;
  providers: Gen3LoginProvider[];
  handleLoginSelected: (url: string) => void;
}) => {
  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <UnstyledButton className={classNames.button}>
          <div className={classNames.label}>Login</div>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Provider Options</Menu.Label>
        {providers.map((provider: Gen3LoginProvider) =>
          provider.urls.map((item: NameUrl) => (
            <Menu.Item
              key={`${provider.name}-${item.url}`}
              onClick={() => handleLoginSelected(item.url)}
              className={classNames.button}
            >
              {`${provider.name}`}
            </Menu.Item>
          )),
        )}
        <Menu.Divider />
      </Menu.Dropdown>
    </Menu>
  );
};

const LoginProvidersMenuPanel = ({
  handleLoginSelected,
  classNames,
}: LoginSelectedProps) => {
  const { data, isSuccess } = useGetLoginProvidersQuery();

  if (!isSuccess) {
    return <LoadingOverlay visible={!isSuccess} />;
  }

  return (
    <div className="flex justify-center">
      <LoginProviderMultipleItemsMenu
        classNames={classNames ?? {}}
        providers={data?.providers}
        handleLoginSelected={handleLoginSelected}
      />
    </div>
  );
};

export default LoginProvidersMenuPanel;
