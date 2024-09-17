import { MantineProvider, Container, Text, Grid } from '@mantine/core';
import { NavPageLayout } from '../../features/Navigation';
import { SmmartLandingPageProps } from './types';

import ProjectCard from './ProjectCard';

const SmmartPage = ({
  headerProps,
  footerProps,
  smmartConfig,
}: SmmartLandingPageProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 Landing Page',
        content: 'Gen3 Landing Page',
        key: 'gen3-landing-page',
      }}
    >
      <MantineProvider withGlobalClasses>
        <div className="w-full pt-20">
          <div className="bg-cbds-primary pt-[1.5%] pb-[1.5%]">
            <Container className="bg-cbds-monoprimary text-center pt-[2.5%] pb-[2.5%]">
              <Text className="text-white text-3xl font-bold">
                Welcome to the Center for Biomedical Data Science Integrated
                Data Portal
              </Text>
              <Text className="text-white text-xl pt-10">
                Explore projects supported by the CBDS-IDP. Discover and
                download datasets.
              </Text>
            </Container>
          </div>
          <Grid gutter="md" className="p-3">
            {smmartConfig.smmartCards.map((project, index) => (
              <Grid.Col span={4}>
                <ProjectCard
                  key={index}
                  title={project.title}
                  description={project.description}
                  icon={project.icon}
                  href={project.href}
                />
              </Grid.Col>
            ))}
          </Grid>
        </div>
      </MantineProvider>
    </NavPageLayout>
  );
};

export default SmmartPage;
