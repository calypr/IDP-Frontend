import React from 'react';
import { Text, Center, Stack } from '@mantine/core';
import { BaseModal } from './BaseModal';
import { LoginMenu } from '../Login';

interface LoginModalProps {
  readonly openModal: boolean;
}

const loginButtonClassNames = {
  button:
    'bg-primary text-white border-none px-12 py-3.5 rounded font-semibold text-lg uppercase tracking-wider hover:bg-opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center min-w-[240px]',
  label: 'text-center w-full',
  dropdownItem: 'font-medium text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors py-3 px-4 block w-full text-left',
};

export const LoginView = ({
  redirectPath,
}: {
  redirectPath?: string;
}): JSX.Element => (
  <div className="py-16 bg-gray-50/20">
    <Stack gap="xl" align="center">
      <Text
        size="lg"
        className="text-center text-gray-600 max-w-sm px-4 leading-relaxed font-medium"
      >
        Please log in to your account to access this content.
      </Text>
      <Center w="100%">
        <LoginMenu
          frontBanner={false}
          classNames={loginButtonClassNames}
          zIndex={2000}
          redirectPath={redirectPath}
        />
      </Center>
    </Stack>
  </div>
);

export const LoginModal = ({ openModal }: LoginModalProps): JSX.Element => {
  return (
    <BaseModal
      title={
        <Text size="xl" className="font-bold font-heading text-primary">
          Login Required
        </Text>
      }
      openModal={openModal}
      size="lg"
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <LoginView />
    </BaseModal>
  );
};
