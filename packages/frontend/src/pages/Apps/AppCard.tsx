import React from 'react';
import { Card, Text } from '@mantine/core';
import { AppCardProps } from './types';
import Image from 'next/image';
import { useRouter } from 'next/router';

const AppCard = ({ title, description, icon, href }: AppCardProps) => {
  const router = useRouter();

  return (
    <Card
      className="hover:shadow-xl hover:scale-[1.02] shadow-lg text-left cursor-pointer flex flex-col rounded-lg"
      onClick={() => router.push(href)}
    >
      <div className="flex justify-left">
        <div className="w-[50px] h-[50px] flex-shrink-0 relative">
          <Image
            src={icon}
            alt={`${title} logo`}
            fill
            className="object-contain"
          />
        </div>
        <div className="items-left p-3">
          <Text className="text-2xl text-left font-bold mb-2">{title}</Text>
          <Text className="text-left text-md text-base-darkest">
            {description}
          </Text>
        </div>
      </div>
    </Card>
  );
};

export default AppCard;
