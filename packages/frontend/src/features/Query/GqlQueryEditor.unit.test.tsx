import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { QueryConfiguration } from './types';

jest.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  default: () => <div data-testid="code-editor" />,
}));

jest.mock('cm6-graphql', () => ({ graphql: () => ({}) }));
jest.mock('@codemirror/autocomplete', () => ({ autocompletion: () => ({}) }));
jest.mock('@codemirror/view', () => ({
  EditorView: { theme: () => ({}) },
}));

jest.mock('@gen3/core', () => ({
  GEN3_LOOM_API: '/loom',
  fetchGraphQL: jest.fn(() => new Promise(() => undefined)),
  resourcePathFromProjectID: (projectID: string) =>
    `/programs/${projectID.replace('-', '/projects/')}`,
  selectHeadersWithCSRFToken: jest.fn(),
  useCoreSelector: () => ({ 'X-CSRF-Token': 'token' }),
  useGetCSRFQuery: () => ({ isLoading: false }),
}));

jest.mock('./project', () => ({
  useQueryProjectSelector: () => ({
    projects: [],
    projectIDs: ['PROGRAM-PROJECT'],
    selectedProjectIDs: ['PROGRAM-PROJECT'],
    isLoading: false,
    isUnavailable: false,
    setSelectedProjectIDs: jest.fn(),
  }),
}));

import GqlQueryEditor from './GqlQueryEditor';

const configuration: QueryConfiguration = {
  version: 2,
  endpoints: {
    loom: {
      url: '/loom/graphql/graph',
      service: 'loom',
      surface: 'graph',
    },
  },
  modes: [
    {
      id: 'dataframe',
      label: 'Dataframe',
      endpoint: 'loom',
      preset: 'loom-fhir-dataframe',
    },
  ],
  defaultMode: 'dataframe',
};

describe('GqlQueryEditor', () => {
  it('stabilizes derived presets instead of resetting state every render', () => {
    render(
      <MantineProvider>
        <GqlQueryEditor configuration={configuration} />
      </MantineProvider>,
    );

    expect(screen.getByText('Query Explorer')).toBeInTheDocument();
    expect(screen.getAllByTestId('code-editor')).toHaveLength(3);

    const queryPane = screen.getByTestId('graphql-query-pane');
    const variablesPane = screen.getByTestId('query-variables-pane');
    const responsePane = screen.getByTestId('response-data-pane');
    const toolbar = screen.getByTestId('query-toolbar');
    const projectSelector = screen.getByRole('textbox', { name: 'Projects' });

    expect(queryPane.parentElement).toBe(variablesPane.parentElement);
    expect(responsePane.parentElement).not.toBe(queryPane.parentElement);
    expect(toolbar).toContainElement(projectSelector);
    expect(variablesPane).not.toContainElement(projectSelector);
  });
});
