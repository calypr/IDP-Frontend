import React from 'react';
import { MantineProvider } from '@mantine/core';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ProjectViewBuilderState } from '@gen3/core';
import { ExplorerViewBuilder } from './ExplorerViewBuilder';

const mockGetProjectViewBuilder = jest.fn();
const mockSaveProjectViewConfig = jest.fn();
const mockDeleteProjectViewConfig = jest.fn();
const mockSaveProjectViewDefaults = jest.fn();
const mockAdoptProjectViewBuilderCatalogs = jest.fn();

jest.mock('@gen3/core', () => ({
  useGetProjectViewBuilderQuery: (...args: unknown[]) =>
    mockGetProjectViewBuilder(...args),
  useSaveProjectViewConfigMutation: () => [
    mockSaveProjectViewConfig,
    { isLoading: false },
  ],
  useDeleteProjectViewConfigMutation: () => [
    mockDeleteProjectViewConfig,
    { isLoading: false },
  ],
  useSaveProjectViewDefaultsMutation: () => [
    mockSaveProjectViewDefaults,
    { isLoading: false },
  ],
  useAdoptProjectViewBuilderCatalogsMutation: () => [
    mockAdoptProjectViewBuilderCatalogs,
    { isLoading: false },
  ],
}));

const project = 'HTAN_INT/BForePC';
const projectConfig = {
  id: 'metadata',
  title: 'Metadata',
  recipeRef: { name: 'clinical_metadata', sourceOption: 'preserve-me' },
  views: [
    {
      id: 'specimens',
      title: 'Specimens',
      output: 'Specimen',
      table: {
        columns: [
          {
            column: 'specimen_id',
            label: 'Specimen ID',
            visible: true,
            pinned: false,
            customPresentation: 'preserve-me',
          },
        ],
      },
      filters: [],
      charts: [],
      fixedFilters: { specimen_status: ['active'] },
      actions: [
        { type: 'download', title: 'Download', columns: ['specimen_id'] },
      ],
      customViewOption: { preserve: true },
    },
  ],
  sharedFilters: { cohort: [{ output: 'Specimen', column: 'specimen_id' }] },
  fileActions: {
    extensions: { csv: ['download'] },
    actions: { download: 'Download' },
  },
  customConfigOption: { preserve: true },
};

const baseState: ProjectViewBuilderState = {
  settings: {
    project,
    version: 4,
    defaultConfigId: 'metadata',
    defaultFrameId: 'clinical_metadata/Specimen',
    catalogs: { clinical_metadata: 'catalog-r1' },
  },
  configs: [{ config: projectConfig, revisionId: 'config-r1' }],
  catalogs: [
    {
      recipeName: 'clinical_metadata',
      revisionId: 'catalog-r1',
      executionId: 'execution-r1',
      generation: 'generation-r1',
      frames: [
        {
          id: 'Specimen',
          title: 'Specimens',
          columns: [
            {
              name: 'specimen_id',
              label: 'Specimen ID',
              logicalType: 'string',
              cardinality: 'required_one',
              filterable: true,
              chartable: true,
            },
          ],
        },
      ],
    },
  ],
  canEdit: true,
};

const onSelectConfig = jest.fn();

const renderViewBuilder = (selectedConfigId?: string) =>
  render(
    <MantineProvider>
      <ExplorerViewBuilder
        project={project}
        selectedConfigId={selectedConfigId}
        onSelectConfig={onSelectConfig}
        viewHref="/Explorer/HTAN_INT%2FBForePC"
      />
    </MantineProvider>,
  );

describe('Project View Builder', () => {
  beforeEach(() => {
    onSelectConfig.mockReset();
    mockGetProjectViewBuilder.mockReset();
    mockGetProjectViewBuilder.mockReturnValue({
      data: baseState,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    mockSaveProjectViewConfig.mockReset();
    mockDeleteProjectViewConfig.mockReset();
    mockSaveProjectViewDefaults.mockReset();
    mockAdoptProjectViewBuilderCatalogs.mockReset();
  });

  it('saves presentation edits with both CAS identities and preserves untouched options', async () => {
    mockSaveProjectViewConfig.mockReturnValue({
      unwrap: () => Promise.resolve(baseState),
    });
    renderViewBuilder('metadata');

    fireEvent.change(screen.getByRole('textbox', { name: 'View title' }), {
      target: { value: 'Clinical metadata' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Column label for Specimen ID' }),
      { target: { value: 'Sample identifier' } },
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use as filter' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use as chart' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pin column' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save config' }));

    await waitFor(() => expect(mockSaveProjectViewConfig).toHaveBeenCalled());
    const request = mockSaveProjectViewConfig.mock.calls[0]?.[0];
    expect(request).toEqual({
      project,
      configId: 'metadata',
      request: {
        expectedRevisionId: 'config-r1',
        catalogRevisionId: 'catalog-r1',
        config: expect.objectContaining({
          title: 'Clinical metadata',
          customConfigOption: { preserve: true },
          recipeRef: { name: 'clinical_metadata', sourceOption: 'preserve-me' },
          sharedFilters: baseState.configs[0]?.config.sharedFilters,
          fileActions: baseState.configs[0]?.config.fileActions,
          views: [
            expect.objectContaining({
              customViewOption: { preserve: true },
              fixedFilters: { specimen_status: ['active'] },
              actions: baseState.configs[0]?.config.views[0]?.actions,
              filters: [{ column: 'specimen_id', label: 'Sample identifier' }],
              charts: [
                {
                  column: 'specimen_id',
                  type: 'bar',
                  title: 'Sample identifier',
                },
              ],
              table: {
                columns: [
                  {
                    column: 'specimen_id',
                    label: 'Sample identifier',
                    visible: true,
                    pinned: true,
                    customPresentation: 'preserve-me',
                  },
                ],
              },
            }),
          ],
        }),
      },
    });
  });

  it('keeps the edited config draft visible after a 409 response', async () => {
    mockSaveProjectViewConfig.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 409,
          code: 'VIEW_CONFIG_REVISION_CONFLICT',
          message: 'The view config revision changed.',
        }),
    });
    renderViewBuilder('metadata');

    const title = screen.getByRole('textbox', { name: 'View title' });
    fireEvent.change(title, { target: { value: 'Unsaved title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save config' }));

    expect(
      await screen.findByText('The view config revision changed.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'View title' })).toHaveValue(
      'Unsaved title',
    );
    expect(
      screen.getByRole('button', { name: 'Discard draft and reload' }),
    ).toBeInTheDocument();
  });

  it('preserves newer local edits when an earlier save resolves', async () => {
    let resolveFirstSave:
      | ((result: ProjectViewBuilderState) => void)
      | undefined;
    const savedFirstVersion: ProjectViewBuilderState = {
      ...baseState,
      configs: [
        {
          config: { ...projectConfig, title: 'First title' },
          revisionId: 'config-r2',
        },
      ],
    };
    mockSaveProjectViewConfig
      .mockReturnValueOnce({
        unwrap: () =>
          new Promise<ProjectViewBuilderState>((resolve) => {
            resolveFirstSave = resolve;
          }),
      })
      .mockReturnValue({
        unwrap: () => Promise.resolve(savedFirstVersion),
      });
    renderViewBuilder('metadata');

    const title = screen.getByRole('textbox', { name: 'View title' });
    fireEvent.change(title, { target: { value: 'First title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save config' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'View title' }), {
      target: { value: 'Second title' },
    });

    await act(async () => {
      resolveFirstSave?.(savedFirstVersion);
    });
    expect(screen.getByRole('textbox', { name: 'View title' })).toHaveValue(
      'Second title',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save config' }));
    await waitFor(() =>
      expect(mockSaveProjectViewConfig).toHaveBeenCalledTimes(2),
    );
    expect(mockSaveProjectViewConfig.mock.calls[1]?.[0].request).toMatchObject({
      expectedRevisionId: 'config-r2',
      config: expect.objectContaining({ title: 'Second title' }),
    });
  });

  it('does not adopt catalogs during read-only GET; adoption requires an explicit click', async () => {
    mockGetProjectViewBuilder.mockReturnValue({
      data: {
        ...baseState,
        settings: { ...baseState.settings, catalogs: {} },
        configs: [],
        catalogs: [],
        canEdit: true,
      },
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    mockAdoptProjectViewBuilderCatalogs.mockReturnValue({
      unwrap: () => Promise.resolve(baseState),
    });
    renderViewBuilder();

    expect(mockAdoptProjectViewBuilderCatalogs).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Use existing published data' }),
    );
    await waitFor(() =>
      expect(mockAdoptProjectViewBuilderCatalogs).toHaveBeenCalledWith({
        project,
      }),
    );
  });
});
