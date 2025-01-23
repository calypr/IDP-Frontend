import { MantineProvider, Button, Text, BackgroundImage } from '@mantine/core';
import { CaliperLandingPageProps } from './types';
import LandingPageContent from '../../components/Content/LandingPageContent';
import { LandingPageProps } from '../../components/Content/LandingPageContent';
import LoginMenu from '../../components/Login/LoginMenu';

interface Props extends CaliperLandingPageProps {
  landingPage: LandingPageProps;
}

const CaliperPage = ({ landingPage, caliperConfig }: Props) => {
  return caliperConfig === undefined ? (
    <div className="flex justify-items-center w-full">
      <LandingPageContent content={landingPage} />
    </div>
  ) : (
    <MantineProvider withGlobalClasses>
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="38"
          height="48"
          viewBox="0 0 174 298"
        >
          <title>OHSU Home</title>
          <desc>Link to OHSU Home</desc>
          <path /* Add SVG paths here */></path>
        </svg>
        <Text size="xl">CALIPER</Text>
      </div>
      <div className="flex items-center gap-4 md:flex-row flex-col">
        <Button variant="subtle" component="a" href="#">
          CBDS
        </Button>
        <LoginMenu />

        <Button variant="subtle" component="a" href="#">
          Contact Us
        </Button>
      </div>

      {/* First Banner */}
      <div
        className="relative text-center text-white h-[350px] bg-cover bg-center"
        style={{ backgroundImage: 'url("your-image-url")' }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50 z-10"></div>
        <div className="relative z-20 flex flex-col justify-center items-center h-full p-4">
          <Text size="xl">CALIPER</Text>
          <Text size="lg">
            Integrated data system tracking OHSU Knight Cancer research datasets
          </Text>
          <Button variant="outline" size="md" mt="md">
            Login
          </Button>
        </div>
      </div>

      {/* Gradient Section */}
      <div className="bg-gradient-to-r from-white to-gray-100 p-8 text-center">
        <Text size="lg">Additional Information Section</Text>
      </div>

      {/* Feature Sections */}
      <div className="relative text-center text-white h-[350px] bg-cover bg-center">
        <Text size="xl">Find new datasets</Text>
        <Text size="lg" color="gray.2">
          Find data to power your research project
        </Text>
      </div>

      <div className="bg-gradient-to-r from-white to-gray-100 p-8 text-center">
        <Text size="lg">Additional Information Section</Text>
      </div>

      <BackgroundImage
        src="https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-6.png"
        radius="sm"
      >
        <Text size="xl">Visualize</Text>
        <Text size="lg" color="gray.2">
          Integrated image viewers
        </Text>
      </BackgroundImage>

      <div className="bg-gradient-to-r from-white to-gray-100 p-8 text-center">
        <Text size="lg">Additional Information Section</Text>

        <BackgroundImage
          src="https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-6.png"
          radius="sm"
        >
          <Text size="xl">Analyze Data</Text>
          <Text size="lg" color="gray.2">
            Tools to analyze complex datasets
          </Text>
        </BackgroundImage>
      </div>
    </MantineProvider>
  );
};

export default CaliperPage;
