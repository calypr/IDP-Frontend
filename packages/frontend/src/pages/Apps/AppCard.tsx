import { Text, Card } from '@mantine/core';
import { AppCardProps } from './types';
import Image from 'next/image';
import { useRouter } from 'next/router';

const AppCard = ({ title, description, icon, href }: AppCardProps) => {
  const router = useRouter();

  return (
    <Card
      className="shadow-lg text-left cursor-pointer flex-1 basis-[10%] m-[5%]"
      onClick={() => router.push(href)}
    >
      <div className="flex items-left space-x-4 p-3">
        <Text className="text-2xl text-left font-bold">{title}</Text>
      </div>

      <div className="flex justify-center">
        <Image src={icon} alt={`${title} logo`} width={200} height={200} />
      </div>
      <Text className="p-5 text-left">{description}</Text>
    </Card>
  );
};

export default AppCard;
