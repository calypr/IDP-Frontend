import {
  BackgroundImage,
  Anchor,
  Text,
  Button,
  Divider,
  Image,
} from '@mantine/core';
import { CaliperLandingPageProps } from './types';
import { LandingPageProps } from '../../components/Content/LandingPageContent';
import { NavPageLayout } from '../../features/Navigation';
import LoginMenu from '../../components/Login/LoginMenu';

interface Props extends CaliperLandingPageProps {
  landingPage: LandingPageProps;
}

const defaultClassNames = {
  label:
    'font-content text-white block hover:text-black hover:border-white hover:bg-white rounded-lg py-3 px-6',
  button:
    'flex flex-nowrap items-center align-middle border-b-2 px-2 border-white border-transparent',
};

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
              <div className="text-4xl font-bold pb-7">CALIPER</div>
              <div className="text-xl font-semibold pb-10">
                Integrated data system tracking OHSU Knight Cancer research
                datasets
              </div>
              <LoginMenu classNames={defaultClassNames}>Login</LoginMenu>
            </div>
          </div>

          <div className="relative w-full h-[350px]">
            <BackgroundImage
              className="absolute inset-0 bg-cover bg-center"
              src="./images/landing/data_explore.png"
            >
              <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
            </BackgroundImage>

            <div className="relative z-20 flex flex-col justify-center items-center text-white p-4 pt-28">
              <div className="text-4xl font-bold pb-7">Find New Datasets</div>
              <div className="text-xl font-semibold pb-10">
                Find data to power your research project
              </div>
            </div>
          </div>

          <div className="relative w-full h-[350px]">
            <BackgroundImage
              className="absolute inset-0 bg-cover bg-center"
              src="./images/landing/image_viewer.png"
            >
              <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
            </BackgroundImage>

            <div className="relative z-20 flex flex-col justify-center items-center text-white p-4 pt-28">
              <div className="text-4xl font-bold pb-7">Visualize</div>
              <div className="text-xl font-semibold pb-10">
                Integrated image viewers
              </div>
            </div>
          </div>

          <div className="relative w-full h-[350px]">
            <BackgroundImage
              className="absolute inset-0 bg-cover bg-center"
              src="./images/landing/data_analysis.png"
            >
              <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
            </BackgroundImage>

            <div className="relative z-20 flex flex-col justify-center items-center text-white p-4 pt-28">
              <div className="text-4xl font-bold pb-7">Analyze Data</div>
              <div className="text-xl font-semibold pb-10">
                Tools for rapid data science
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 md:px-10 px-4 py-12">
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
                    className="mt-4 inline-block px-4 py-2 rounded tracking-wider bg-orange-500 hover:bg-orange-600 text-white text-[13px]"
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
                    Early Dectection
                  </div>
                  <div className="text-gray-500 text-sm">CEDAR</div>
                  <Button
                    component="a"
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://www.ohsu.edu/knight-cancer-institute/cedar"
                    className="mt-4 inline-block px-4 py-2 rounded tracking-wider bg-orange-500 hover:bg-orange-600 text-white text-[13px]"
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
                    className="mt-4 inline-block px-4 py-2 rounded tracking-wider bg-orange-500 hover:bg-orange-600 text-white text-[13px]"
                  >
                    Read More
                  </Button>
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

export default CaliperPage;
