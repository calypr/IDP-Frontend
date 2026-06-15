import React from 'react';
import {
  BackgroundImage,
  Anchor,
  Text,
  Button,
  Divider,
  Image,
  Center,
  Loader,
} from '@mantine/core';
import { CalyprLandingPageProps } from './types';
import { LandingPageProps } from '../../components/Content/LandingPageContent';
import { NavPageLayout } from '../../features/Navigation';
import LoginMenu from '../../components/Login/LoginMenu';
import AppsPage from '../Apps/Apps';
import { useSession } from '../../lib/session/session';

interface Props extends CalyprLandingPageProps {
  landingPage: LandingPageProps;
}

const defaultClassNames = {
  label:
    'bg-primary font-content text-white block hover:text-white hover:border-secondary hover:bg-secondary rounded-lg py-3 px-6 active:scale-95',
  button:
    'flex flex-nowrap items-center align-middle border-b-2 border-white border-transparent',
};
const BannerPanel = ({
  title,
  text,
  imagePath,
}: {
  title: string;
  text: string;
  imagePath: string;
}) => {
  return (
    <div className="relative w-full h-[350px]">
      <BackgroundImage
        className="absolute inset-0 bg-cover bg-center"
        src={imagePath}
      >
        <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
      </BackgroundImage>
      <div className="relative z-20 flex flex-col justify-center items-center text-white p-4 pt-28">
        <div className="text-4xl font-bold pb-7">{title}</div>
        <div className="text-xl font-semibold pb-10">{text}</div>
      </div>
    </div>
  );
};
const CalyprPage = ({
  headerProps,
  footerProps,
  hasAuthenticatedSession = false,
}: Props) => {
  const session = useSession(false);
  const shouldShowAuthenticatedHome =
    hasAuthenticatedSession || session.status === 'issued';

  if (session.pending && !shouldShowAuthenticatedHome) {
    return (
      <NavPageLayout
        {...{ headerProps, footerProps }}
        headerMetadata={{
          title: 'CALYPR Home',
          content: 'Loading home page',
          key: 'calypr-home-loading',
        }}
      >
        <Center className="min-h-[60vh]">
          <Loader />
        </Center>
      </NavPageLayout>
    );
  }

  if (shouldShowAuthenticatedHome) {
    return (
      <AppsPage
        {...{ headerProps, footerProps }}
        headerMetadata={{
          title: 'CALYPR Projects',
          content: 'Project catalog',
          key: 'calypr-project-catalog-home',
        }}
      />
    );
  }

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR Landing Page',
        content: 'Landing Page',
        key: 'calypr-landing-page',
      }}
    >
      <div className="flex flex-col w-full">
        <div className="flex flex-col w-full gap-24">
          <div className="relative w-full h-[350px]">
            <BackgroundImage
              className="absolute inset-0 bg-cover bg-center"
              src="./images/landing/dna-blue-banner-8x3.jpg"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black to-black opacity-60 z-10"></div>
            </BackgroundImage>

            <div className="relative z-20 flex flex-col justify-center items-center text-white p-4 pt-20">
              <div className="text-4xl font-bold pb-7">CALYPR</div>
              <div className="text-xl font-semibold pb-10">
                Integrated data system tracking OHSU Knight Cancer Institute
                research datasets
              </div>
              <LoginMenu frontBanner={true} classNames={defaultClassNames} />
            </div>
          </div>

          <BannerPanel
            title={'Find New Datasets'}
            text={'Find data to power your research project'}
            imagePath="./images/landing/open_access_explorer.png"
          />

          <BannerPanel
            title={'Visualize'}
            text={'Integrated image viewers'}
            imagePath="./images/landing/image_viewer.png"
          />

          <BannerPanel
            title={'Analyze Data'}
            text={'Tools for rapid data science'}
            imagePath="./images/landing/data_analysis.png"
          />
        </div>

        <div className="bg-gray-100 md:px-10 px-4 py-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-left pb-8">
              <Text className="text-3xl font-extrabold text-gray-800 inline-block">
                Areas of Focus
              </Text>
            </div>
            <div className="max-w-5xl max-lg:max-w-3xl max-sm:max-w-sm mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-sm:gap-8">
                <div className="bg-white rounded">
                  <Image
                    src="./images/landing/smmart-circle-diagram.png"
                    alt="Precision Oncology"
                    className="w-full h-52 object-cover rounded-t-md"
                  />
                  <div className="p-6">
                    <div className="text-lg font-bold text-gray-800 mb-3">
                      Precision Oncology
                    </div>
                    <div className="text-gray-500 text-sm">SMMART</div>
                    <Button
                      component="a"
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://www.ohsu.edu/knight-cancer-institute/smmart-clinical-trials-research"
                      className="mt-4 inline-block px-4 py-2 rounded tracking-wider bg-orange-700 hover:bg-orange-800 text-white text-[13px]"
                    >
                      Read More
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded">
                  <Image
                    src="./images/landing/CEDAR_People_0.png"
                    alt="Blog Post 2"
                    className="w-full h-52 object-cover"
                  />
                  <div className="p-6">
                    <div className="text-lg font-bold text-gray-800 mb-3">
                      Early Detection
                    </div>
                    <div className="text-gray-500 text-sm">CEDAR</div>
                    <Button
                      component="a"
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://www.ohsu.edu/knight-cancer-institute/cedar"
                      className="mt-4 inline-block px-4 py-2 rounded tracking-wider bg-orange-700 hover:bg-orange-800 text-white text-[13px]"
                    >
                      Read More
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded">
                  <Image
                    src="./images/landing/ARC-all.jpg"
                    alt="Precision Oncology"
                    className="w-full h-52 object-cover rounded-t-md"
                  />
                  <div className="p-6">
                    <div className="text-lg font-bold text-gray-800 mb-3">
                      Data Science
                    </div>
                    <div className="text-gray-500 text-sm">CBDS</div>
                    <Button
                      component="a"
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://www.ohsu.edu/knight-cancer-institute/center-biomedical-data-science"
                      className="mt-4 inline-block px-4 py-2 rounded tracking-wider bg-orange-700 hover:bg-orange-800 text-white text-[13px]"
                    >
                      Read More
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 sm:px-6 px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-left">
              <Text className="text-3xl font-extrabold text-gray-800 inline-block">
                Publications
              </Text>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mt-16 max-md:max-w-lg mx-auto">
              <div>
                <Text className="text-sm block text-gray-400 mb-2">
                  December 2024
                </Text>
                <div className="cursor-pointer rounded overflow-hidden group">
                  <Anchor
                    className="text-xl font-bold text-gray-800 group-hover:text-blue-500 transition-all"
                    href="https://genomebiology.biomedcentral.com/articles/10.1186/s13059-024-03431-3"
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="never"
                  >
                    SyntheVAEiser: augmenting traditional machine learning
                    methods with VAE-based gene expression sample generation for
                    improved cancer subtype predictions.
                  </Anchor>
                </div>

                <div className="mt-4">
                  <Text className="text-gray-400 text-sm">
                    Karlberg B, Kirchgaessner R, Lee J, Peterkort M, Beckman L,
                    Goecks J, Ellrott K.
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    Genome Biol. 2024 Dec 18;25(1):309. doi:
                    10.1186/s13059-024-03431-3.
                  </Text>
                </div>
                <Divider className="my-5 border-gray-300" />
              </div>
              <div>
                <Text className="text-sm block text-gray-400 mb-2">
                  Janurary 2023
                </Text>
                <div className="cursor-pointer rounded overflow-hidden group">
                  <Anchor
                    className="text-xl font-bold text-gray-800 group-hover:text-blue-500 transition-all"
                    href="https://www.sciencedirect.com/science/article/pii/S2666979X21001063"
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="never"
                  >
                    Inverting the model of genomics data sharing with the NHGRI
                    Genomic Data Science Analysis, Visualization, and
                    Informatics Lab-space
                  </Anchor>
                </div>

                <div className="mt-4">
                  <Text className="text-gray-400 text-sm">
                    Cell Genom. 2022 Jan 12;2(1):100085. doi:
                    10.1016/j.xgen.2021.100085. Epub 2022 Jan 13
                  </Text>
                </div>
                <Divider className="my-5 border-gray-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </NavPageLayout>
  );
};

export default CalyprPage;
