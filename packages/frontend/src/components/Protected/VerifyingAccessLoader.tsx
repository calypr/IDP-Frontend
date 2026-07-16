import React from 'react';
import { Loader, Text } from '@mantine/core';

export const VerifyingAccessLoader = ({
  message = 'Verifying account access...',
}: {
  message?: string;
}) => (
  <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-gray-100">
    <Loader size={50} color="blue" />
    <Text mt="xl" className="text-gray-600 font-medium animate-pulse">
      {message}
    </Text>
  </div>
);
