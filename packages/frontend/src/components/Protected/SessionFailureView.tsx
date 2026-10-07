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
        title="The service could not complete this request"
        color="orange"
        variant="light"
      >
        <Stack gap="sm">
          <Text>
            The service could not complete this request. You can retry when it
            is available.
          </Text>
          {detail && (
            <Text size="sm" c="dimmed">
              {detail}
            </Text>
          )}
        </Stack>
      </Alert>
      <Title order={3}>
        Try the request again when the service is available.
      </Title>
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
