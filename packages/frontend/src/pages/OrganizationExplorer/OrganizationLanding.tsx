import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Card,
  Collapse,
  Container,
  Popover,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconBuildingBank,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useGetAuthzMappingsQuery } from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout } from '../../features/Navigation';
import type {
  OrganizationExplorerPageProps,
  OrganizationGroup,
} from './types';
import {
  extractAccessibleProjects,
  groupProjectsByOrganization,
} from './utils';

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const CompactProjectRow = ({
  href,
  project,
  resourcePath,
}: {
  href: string;
  project: string;
  resourcePath: string;
}) => (
  <Link href={href} legacyBehavior>
    <a className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border-t border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50">
      <div className="min-w-0">
        <Text fw={600} truncate>
          {project}
        </Text>
        <Text c="dimmed" size="xs" truncate>
          {resourcePath}
        </Text>
      </div>
      <Text c="dimmed" size="sm">
        Open
      </Text>
    </a>
  </Link>
);

const OrganizationRow = ({
  group,
  initiallyOpen = false,
  hideCollapse = false,
}: {
  group: OrganizationGroup;
  initiallyOpen?: boolean;
  hideCollapse?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const isExpanded = hideCollapse ? true : isOpen;

  return (
    <Card padding={0} radius="lg" withBorder>
      {hideCollapse ? (
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
          <Link href="/organization" legacyBehavior>
            <a className="inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              <IconChevronLeft size={16} />
              Organizations
            </a>
          </Link>
          <div className="min-w-0 text-center">
            <Text fw={700} size="lg" truncate>
              {group.organization}
            </Text>
          </div>
          <Text c="dimmed" size="sm">
            {pluralize(group.projects.length, 'project')}
          </Text>
        </div>
      ) : (
        <button
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          {isOpen ? (
            <IconChevronDown className="text-slate-500" size={18} />
          ) : (
            <IconChevronRight className="text-slate-500" size={18} />
          )}
          <div className="min-w-0">
            <Text fw={700} size="lg">
              {group.organization}
            </Text>
          </div>
          <Text c="dimmed" size="sm">
            {pluralize(group.projects.length, 'project')}
          </Text>
        </button>
      )}

      <Collapse in={isExpanded}>
        <div className="border-t border-slate-200 bg-white">
          {group.projects.map((project) => {
            return (
              <CompactProjectRow
                href={`/organization/${encodeURIComponent(project.organization)}/project/${encodeURIComponent(project.project)}`}
                key={project.resourcePath}
                project={project.project}
                resourcePath={project.resourcePath}
              />
            );
          })}
        </div>
      </Collapse>
    </Card>
  );
};

const OrganizationLandingPage = ({
  headerProps,
  footerProps,
  selectedOrganization,
}: OrganizationExplorerPageProps & {
  selectedOrganization?: string;
}) => {
  const { data: authzMapping = {}, isLoading } = useGetAuthzMappingsQuery();
  const [searchQuery, setSearchQuery] = useState('');

  const organizationGroups = useMemo(
    () => groupProjectsByOrganization(extractAccessibleProjects(authzMapping)),
    [authzMapping],
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchableProjects = useMemo(
    () => extractAccessibleProjects(authzMapping),
    [authzMapping],
  );
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    const organizationResults = organizationGroups
      .filter((group) =>
        group.organization.toLowerCase().includes(normalizedSearchQuery),
      )
      .map((group) => ({
        href: `/organization/${encodeURIComponent(group.organization)}`,
        key: `organization-${group.organization}`,
        kind: 'organization' as const,
        label: group.organization,
        sublabel: pluralize(group.projects.length, 'project'),
      }));

    const projectResults = searchableProjects
      .filter((project) =>
        project.project.toLowerCase().includes(normalizedSearchQuery),
      )
      .map((project) => ({
        href: `/organization/${encodeURIComponent(project.organization)}/project/${encodeURIComponent(project.project)}`,
        key: `project-${project.resourcePath}`,
        kind: 'project' as const,
        label: project.project,
        sublabel: project.organization,
      }));

    return [...organizationResults, ...projectResults].slice(0, 12);
  }, [normalizedSearchQuery, organizationGroups, searchableProjects]);
  const visibleOrganizationGroups = useMemo(() => {
    const scopedGroups = !selectedOrganization
      ? organizationGroups
      : organizationGroups.filter(
          (group) => group.organization === selectedOrganization,
        );

    if (!normalizedSearchQuery) {
      return scopedGroups;
    }

    return scopedGroups
      .map((group) => {
        const matchesOrganization = group.organization
          .toLowerCase()
          .includes(normalizedSearchQuery);

        if (matchesOrganization) {
          return group;
        }

        const matchingProjects = group.projects.filter((project) =>
          project.project.toLowerCase().includes(normalizedSearchQuery),
        );

        if (matchingProjects.length === 0) {
          return null;
        }

        return {
          ...group,
          projects: matchingProjects,
        };
      })
      .filter((group): group is OrganizationGroup => group !== null);
  }, [normalizedSearchQuery, organizationGroups, selectedOrganization]);

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: 'Syfon organization explorer',
        key: 'syfon-organization-explorer',
        title: 'Organization Explorer',
      }}
    >
      <ProtectedContent>
        <div className="min-h-screen bg-[#f6f8fa]">
          <Container py="lg" size="lg">
            <Stack gap="md">
              <Card padding="md" radius="lg" withBorder>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Text fw={700} size="lg">
                      {selectedOrganization || 'Organizations'}
                    </Text>
                    <Text c="dimmed" size="sm">
                      Search organizations and projects you can access.
                    </Text>
                  </div>
                  <Popover
                    opened={normalizedSearchQuery.length > 0}
                    position="bottom-end"
                    shadow="md"
                    width={360}
                    withinPortal
                  >
                    <Popover.Target>
                      <TextInput
                        className="w-full max-w-md"
                        leftSection={<IconSearch size={16} />}
                        onChange={(event) => setSearchQuery(event.currentTarget.value)}
                        placeholder="Search organizations or projects"
                        rightSection={
                          searchQuery ? (
                            <ActionIcon
                              aria-label="Clear organization search"
                              onClick={() => setSearchQuery('')}
                              size="sm"
                              variant="subtle"
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          ) : null
                        }
                        size="sm"
                        value={searchQuery}
                      />
                    </Popover.Target>
                    <Popover.Dropdown p={0}>
                      <div className="max-h-[24rem] overflow-y-auto py-2">
                        {searchResults.length > 0 ? (
                          searchResults.map((result) => (
                            <Link href={result.href} key={result.key} legacyBehavior>
                              <a
                                className="flex items-start gap-3 px-3 py-2 text-left hover:bg-slate-50"
                                onClick={() => setSearchQuery('')}
                              >
                                {result.kind === 'organization' ? (
                                  <IconBuildingBank
                                    className="mt-0.5 text-slate-500"
                                    size={16}
                                  />
                                ) : (
                                  <IconFolder
                                    className="mt-0.5 text-sky-600"
                                    size={16}
                                  />
                                )}
                                <div className="min-w-0">
                                  <Text fw={600} size="sm">
                                    {result.label}
                                  </Text>
                                  <Text c="dimmed" className="truncate" size="xs">
                                    {result.sublabel}
                                  </Text>
                                </div>
                              </a>
                            </Link>
                          ))
                        ) : (
                          <Text c="dimmed" className="px-3 py-3" size="sm">
                            No organizations or projects match “{searchQuery}”.
                          </Text>
                        )}
                      </div>
                    </Popover.Dropdown>
                  </Popover>
                </div>
              </Card>

              {isLoading ? (
                <Card padding="md" radius="lg" withBorder>
                  <Text c="dimmed" size="sm">
                    Loading your accessible organizations...
                  </Text>
                </Card>
              ) : visibleOrganizationGroups.length === 0 ? (
                <Card padding="md" radius="lg" withBorder>
                  <Text fw={700}>
                    {normalizedSearchQuery
                      ? 'No matching organizations or projects'
                      : 'No accessible projects'}
                  </Text>
                  <Text c="dimmed" className="mt-1" size="sm">
                    {normalizedSearchQuery
                      ? 'Try a different search term.'
                      : 'No project-scoped Syfon permissions were found for this account.'}
                  </Text>
                </Card>
              ) : (
                <Stack gap="xs">
                  {visibleOrganizationGroups.map((group) => (
                    <OrganizationRow
                      group={group}
                      initiallyOpen={group.organization === selectedOrganization}
                      hideCollapse={group.organization === selectedOrganization}
                      key={group.organization}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Container>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default OrganizationLandingPage;
