import { Button, Text, BackgroundImage } from '@mantine/core';
import { CaliperLandingPageProps } from './types';
import { LandingPageProps } from '../../components/Content/LandingPageContent';
import { NavPageLayout } from '../../features/Navigation';

interface Props extends CaliperLandingPageProps {
  landingPage: LandingPageProps;
}

const CaliperPage = ({ headerProps, footerProps }: Props) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 Landing Page',
        content: 'Landing Page',
        key: 'gen3-landing-page',
      }}
    >
      <BackgroundImage
        src="https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-6.png"
        radius="sm"
      >
        <div className="relative z-20 flex flex-col justify-center items-center h-full p-4">
          <Text size="xl">CALIPER</Text>
          <Text size="lg">
            Integrated data system tracking OHSU Knight Cancer research datasets
          </Text>
          <Button variant="outline" size="md" mt="md">
            Login
          </Button>
        </div>
      </BackgroundImage>
    </NavPageLayout>
  );
};

export default CaliperPage;
