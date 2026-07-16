import React from 'react';
import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

type SessionFailureViewProps = {
  detail?: string;
  onRetry: () => void;
  onRestartLogin?: () => void;
};

const SessionFailureView = ({
  detail,
  onRetry,
  onRestartLogin,
}: SessionFailureViewProps) => (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-gray-100 px-6">
    <Stack maw={560} gap="lg">
      <Alert
        icon={<IconAlertTriangle size={22} />}
        title="We could not verify your session"
        color="orange"
        variant="light"
      >
        <Stack gap="sm">
          <Text>
            The authentication service did not respond in time. Your browser is
            not stuck, and this page will not keep waiting indefinitely.
          </Text>
          {detail && (
            <Text size="sm" c="dimmed">
              {detail}
            </Text>
          )}
        </Stack>
      </Alert>
      <Title order={3}>Try the request again or start a clean sign-in.</Title>
      <Group>
        <Button leftSection={<IconRefresh size={18} />} onClick={onRetry}>
          Retry verification
        </Button>
        {onRestartLogin && (
          <Button variant="default" onClick={onRestartLogin}>
            Restart sign-in
          </Button>
        )}
      </Group>
    </Stack>
  </div>
);

export default SessionFailureView;
