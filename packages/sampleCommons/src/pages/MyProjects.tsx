import { useState } from 'react';
import { useDeepCompareMemo } from 'use-deep-compare';
import {
  Paper,
  Title,
  Text,
  Badge,
  Box,
  Collapse,
  ActionIcon,
  Group,
  Container,
  Loader,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import {
  getNavPageLayoutPropsFromConfig,
  NavPageLayout,
  NavPageLayoutProps,
  ProtectedContent,
} from '@gen3/frontend';
import { useGetAuthzMappingsQuery } from '@gen3/core';
import { GetServerSideProps } from 'next';

interface Project {
  name: string;
  status: 'active' | 'planning' | 'completed';
}

interface Program {
  program: string;
  description: string;
  projects: Project[];
}

interface TreeViewProps {
  demoData: Program[];
}

const convertAuthZToPrograms = (authz: any): Program[] => {
  // create a map to group projects by program
  const programMap = new Map();

  // get only project mappings
  const paths = Object.keys(authz).filter((resource) => {
    const path = resource.split('/');
    return (
      path?.length === 5 && path[1] === 'programs' && path[3] === 'projects'
    );
  });

  paths.forEach((path) => {
    // split the path and extract program and project
    const parts = path.split('/').filter((part) => part);
    const program = parts[1].toUpperCase();
    const projectName = parts[3];

    // if program doesn't exist in map, initialize it
    if (!programMap.has(program)) {
      programMap.set(program, {
        program: program,
        description: `${program} Program`, // hardcoded description for now
        projects: [],
      });
    }

    // Add project to the program
    programMap.get(program).projects.push({
      name: projectName,
      status: 'active', // hardcoded default status
    });
  });

  // Convert map to array format matching demoData structure
  return Array.from(programMap.values());
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'green';
    case 'in progress':
      return 'blue';
    case 'completed':
      return 'gray';
  }
};

export const ProgramProjectsDisplay = ({
  headerProps,
  footerProps,
}: NavPageLayoutProps) => {
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(
    new Set(),
  );

  const { data: authzMapping = {}, isLoading: isAuthZLoading } =
    useGetAuthzMappingsQuery();

  const demoData = useDeepCompareMemo(() => {
    if (!isAuthZLoading && authzMapping) {
      return convertAuthZToPrograms(authzMapping);
    }
    return [];
  }, [authzMapping, isAuthZLoading]);

  const toggleProgram = (program: string) => {
    const newExpanded = new Set(expandedPrograms);
    if (newExpanded.has(program)) {
      newExpanded.delete(program);
    } else {
      newExpanded.add(program);
    }
    setExpandedPrograms(newExpanded);
  };

  const TreeView = ({ demoData }: TreeViewProps) => {
    console.log(demoData);
    return (
      <Box>
        {demoData.map((program) => (
          <Paper key={program.program} shadow="xs" p="md" mb="md">
            <Group
              onClick={() => toggleProgram(program.program)}
              style={{ cursor: 'pointer' }}
            >
              <ActionIcon variant="subtle">
                {expandedPrograms.has(program.program) ? (
                  <IconChevronDown size={16} />
                ) : (
                  <IconChevronRight size={16} />
                )}
              </ActionIcon>
              <Title order={4}>{program.program}</Title>
            </Group>

            <Collapse in={expandedPrograms.has(program.program)}>
              <Text color="dimmed" size="sm" mt="xs" mb="md">
                {program.description}
              </Text>
              <Box pl="xl">
                {program.projects.map((project) => (
                  <Group key={project.name} mb="xs">
                    <Text size="sm">{project.name}</Text>
                    <Badge color={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </Group>
                ))}
              </Box>
            </Collapse>
          </Paper>
        ))}
      </Box>
    );
  };

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR My Projects Page',
        content: 'My Projects',
        key: 'my-projects-page',
      }}
    >
      <ProtectedContent>
        <div className="w-full relative">
          <Container size="lg" px="md">
            <Title size="h1" className="py-2 px-4">
              List of Projects
            </Title>
            {isAuthZLoading && (
              <div className="fixed inset-0 flex justify-center items-center bg-gray-700 bg-opacity-50 z-50">
                <Loader size={30} />
              </div>
            )}
            {!isAuthZLoading && <TreeView demoData={demoData} />}
          </Container>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default ProgramProjectsDisplay;
