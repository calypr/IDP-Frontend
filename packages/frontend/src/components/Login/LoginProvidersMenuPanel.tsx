import { LoadingOverlay, Menu, Button } from '@mantine/core';
import {
  type Gen3LoginProvider,
  type NameUrl,
  useGetLoginProvidersQuery,
} from '@gen3/core';
import { LoginSelectedProps } from './types';

const LoginProviderMultipleItemsMenu = ({
  providers,
  handleLoginSelected,
}: {
  providers: Gen3LoginProvider[];
  handleLoginSelected: (url: string) => void;
}) => {
  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Button className="py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600">
          Login
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Provider Options</Menu.Label>
        {providers.map((provider: Gen3LoginProvider) =>
          provider.urls.map((item: NameUrl) => (
            <Menu.Item
              key={`${provider.name}-${item.url}`}
              onClick={() => handleLoginSelected(item.url)}
              className="hover:text-accent-light"
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
}: LoginSelectedProps) => {
  const { data, isSuccess } = useGetLoginProvidersQuery();

  if (!isSuccess) {
    return <LoadingOverlay visible={!isSuccess} />;
  }

  return (
    <div className="flex justify-center">
      <LoginProviderMultipleItemsMenu
        providers={data?.providers}
        handleLoginSelected={handleLoginSelected}
      />
    </div>
  );
};

export default LoginProvidersMenuPanel;
