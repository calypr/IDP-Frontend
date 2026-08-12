import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GuidedBuilder, rowGrainForResource } from './GuidedBuilder';

describe('rowGrainForResource', () => {
  it.each([
    ['Patient', 'patient'],
    ['DocumentReference', 'file'],
    ['ResearchSubject', 'study_enrollment'],
    ['ResearchStudy', 'resource'],
    ['MedicationAdministration', 'resource'],
  ])('maps %s to Loom grain %s', (resourceType, expected) => {
    expect(rowGrainForResource(resourceType)).toBe(expected);
  });
});

jest.mock('./fhirProjectMap', () => ({
  scanFhirProjectMap: jest.fn().mockResolvedValue({
    nodes: [
      {
        resourceType: 'Patient',
        documentCount: 12,
        fields: [
          {
            fieldRef: 'Patient.id',
            label: 'Patient ID',
            path: 'id',
            selector: { valuePath: 'id' },
          },
          {
            fieldRef: 'Patient.gender',
            label: 'Administrative gender',
            path: 'gender',
            selector: { valuePath: 'gender' },
          },
          {
            fieldRef: 'Patient.name',
            label: 'Name',
            path: 'name',
            selector: { valuePath: 'name' },
          },
          {
            fieldRef: 'Patient.name.family',
            label: 'Family name',
            path: 'name.family',
            selector: { valuePath: 'name.family' },
          },
        ],
        traversals: [],
      },
      {
        resourceType: 'Condition',
        documentCount: 8,
        fields: [
          {
            fieldRef: 'Condition.code',
            label: 'Condition code',
            path: 'code',
            selector: { sourcePath: 'Condition', valuePath: 'code' },
          },
        ],
        traversals: [],
      },
      {
        resourceType: 'Specimen',
        documentCount: 3,
        fields: [
          {
            fieldRef: 'Specimen.id',
            label: 'Specimen ID',
            path: 'id',
            selector: { valuePath: 'id' },
          },
        ],
        traversals: [],
      },
    ],
    edges: [
      { fromType: 'Patient', label: 'subject_Condition', toType: 'Condition', edgeCount: 40 },
      { fromType: 'Condition', label: 'subject_Specimen', toType: 'Specimen', edgeCount: 20 },
      { fromType: 'Specimen', label: 'subject_Patient', toType: 'Patient', edgeCount: 1 },
    ],
  }),
}));

describe('GuidedBuilder', () => {
  const openNodeInspector = async (resourceType: string) => {
    await screen.findAllByText(new RegExp(resourceType, 'i'));
    const node = document.querySelector(`.react-flow__node[data-id="${resourceType}"]`);
    expect(node).not.toBeNull();
    fireEvent.click(node!);
  };
  const renderTable = () => {
    fireEvent.click(screen.getAllByRole('button', { name: /^render table/i })[0]);
  };

  it('turns steward choices into a recipe and Explorer table without exposing JSON', async () => {
    const onRecipeChange = jest.fn();
    const onExplorerChange = jest.fn();
    const onPreview = jest.fn();
    render(
      <GuidedBuilder
        disabled={false}
        explorer={{ schemaVersion: 1, tabs: [] }}
        onExplorerChange={onExplorerChange}
        onPreview={onPreview}
        onRecipeChange={onRecipeChange}
        organization="acme"
        project="study"
        recipe={{}}
        recipeSource="platform-default"
      />,
    );

    await openNodeInspector('Patient');
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /patient id/i })).toBeChecked(),
    );
    await waitFor(() => expect(onRecipeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        outputs: expect.arrayContaining([
          expect.objectContaining({ name: 'Default_Explorer', rootResourceType: 'Patient' }),
        ]),
      }),
    ));
    expect(onExplorerChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: expect.arrayContaining([
          expect.objectContaining({ title: 'Default Explorer', output: 'Default_Explorer' }),
        ]),
      }),
    );
    renderTable();
    expect(screen.getByRole('region', { name: /rendered table/i })).toBeInTheDocument();

    expect(onRecipeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeSchemaVersion: 1,
        outputs: expect.arrayContaining([
          expect.objectContaining({
            rootResourceType: 'Patient',
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'id',
                expr: { select: 'root.id' },
              }),
            ]),
          }),
        ]),
      }),
    );
    expect(onExplorerChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [
          expect.objectContaining({
            table: expect.objectContaining({
              columns: expect.arrayContaining([
                expect.objectContaining({ field: 'id', visible: true }),
              ]),
            }),
          }),
        ],
      }),
    );
    expect(onPreview).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outputs: expect.any(Array) }),
    );
    expect(screen.queryByLabelText(/advanced json/i)).not.toBeInTheDocument();
  });

  it('offers leaf data fields while explaining hidden structural containers', async () => {
    render(
      <GuidedBuilder
        disabled={false}
        explorer={{ schemaVersion: 1, tabs: [] }}
        onExplorerChange={jest.fn()}
        onPreview={jest.fn()}
        onRecipeChange={jest.fn()}
        organization="acme"
        project="study"
        recipe={{}}
      />,
    );

    await openNodeInspector('Patient');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /family name/i })).toBeInTheDocument());
    expect(screen.queryByRole('checkbox', { name: /^name$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/1 structural field hidden/i)).toBeInTheDocument();
    expect(screen.getByText(/12 populated records/i)).toBeInTheDocument();
  });

  it('uses the complete catalog path and exact outbound edge labels for nested traversals', async () => {
    const onRecipeChange = jest.fn();
    const onExplorerChange = jest.fn();
    render(
      <GuidedBuilder
        disabled={false}
        explorer={{ schemaVersion: 1, tabs: [] }}
        onExplorerChange={onExplorerChange}
        onPreview={jest.fn()}
        onRecipeChange={onRecipeChange}
        organization="acme"
        project="study"
        recipe={{}}
      />,
    );

    await openNodeInspector('Patient');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /patient id/i })).toBeChecked());
    await openNodeInspector('Condition');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /condition code/i })).toBeInTheDocument());
    const conditionCode = screen.getByRole('checkbox', { name: /condition code/i }) as HTMLInputElement;
    if (!conditionCode.checked) fireEvent.click(conditionCode);
    fireEvent.click(screen.getByRole('button', { name: /add diagnoses and conditions to traversal/i }));
    await openNodeInspector('Specimen');
    fireEvent.click(await screen.findByRole('button', { name: /add biospecimens to traversal/i }));
    await openNodeInspector('Condition');
    renderTable();

    const recipe = onRecipeChange.mock.calls.at(-1)?.[0];
    const rootTraversal = recipe.outputs[0].traversals[0];
    expect(rootTraversal).toEqual(expect.objectContaining({
      name: 'subject_Condition',
      toResourceType: 'Condition',
      alias: 'condition',
      matchMode: 'OPTIONAL',
    }));
    expect(rootTraversal.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'code', expr: { select: 'condition.code' } }),
    ]));
    expect(rootTraversal.traversals[0]).toEqual(expect.objectContaining({
      name: 'subject_Specimen',
      toResourceType: 'Specimen',
      alias: 'specimen',
    }));
    const explorer = onExplorerChange.mock.calls.at(-1)?.[0];
    expect(explorer.tabs[0].table.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'condition__code', visible: true }),
    ]));
    expect(screen.getByRole('heading', { name: /rendered table/i })).toBeInTheDocument();
    expect(screen.queryByText('Patient ID')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Explorer sample preview')).toBeInTheDocument();
  });

  it('previews a reachable dataset before explicitly locking it into a removable traversal', async () => {
    const onRecipeChange = jest.fn();
    render(<GuidedBuilder disabled={false} explorer={{ schemaVersion: 1, tabs: [] }} onExplorerChange={jest.fn()} onPreview={jest.fn()} onRecipeChange={onRecipeChange} organization="acme" project="study" recipe={{}} recipeSource="platform-default" />);

    await waitFor(() => expect(onRecipeChange).toHaveBeenCalled());
    onRecipeChange.mockClear();
    await openNodeInspector('Condition');
    expect(screen.getByText(/available next step/i)).toBeInTheDocument();
    expect(onRecipeChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /add diagnoses and conditions to traversal/i }));
    await waitFor(() => expect(onRecipeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        outputs: expect.arrayContaining([
          expect.objectContaining({
            traversals: expect.arrayContaining([
              expect.objectContaining({ toResourceType: 'Condition' }),
            ]),
          }),
        ]),
      }),
    ));
    expect(screen.getByRole('navigation', { name: /locked traversal/i })).toHaveTextContent(/people.*diagnoses and conditions/i);

    fireEvent.click(screen.getByRole('button', { name: /remove diagnoses and conditions and following traversal steps/i }));
    await waitFor(() => {
      const document = onRecipeChange.mock.calls.at(-1)?.[0];
      expect(document.outputs[0].traversals).toEqual([]);
    });
  });

  it('replaces and edits the active output instead of mutating the first table', async () => {
    const onRecipeChange = jest.fn();
    const onExplorerChange = jest.fn();
    const recipe = {
      recipeSchemaVersion: 1,
      outputs: [
        { name: 'First', rootResourceType: 'Patient', rowGrain: 'patient', fields: [{ name: 'id', expr: { select: 'root.id' } }] },
        { name: 'Second', rootResourceType: 'Patient', rowGrain: 'patient', fields: [{ name: 'id', expr: { select: 'root.id' } }] },
      ],
    };
    const explorer = {
      schemaVersion: 1,
      tabs: [
        { id: 'first', title: 'First', output: 'First', table: { columns: [{ field: 'id', label: 'ID', visible: true }] } },
        { id: 'second', title: 'Second', output: 'Second', table: { columns: [{ field: 'id', label: 'ID', visible: true }] } },
      ],
    };
    const { rerender } = render(<GuidedBuilder disabled={false} explorer={explorer} onExplorerChange={onExplorerChange} onPreview={jest.fn()} onRecipeChange={onRecipeChange} organization="acme" project="study" recipe={recipe} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /second/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /second/i })[0]);
    await openNodeInspector('Patient');
    const title = screen.getByLabelText(/what should this table be called/i) as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Renamed' } });
    fireEvent.blur(title);
    const renamed = onRecipeChange.mock.calls.at(-1)?.[0];
    expect(renamed.outputs.map((output: { name: string }) => output.name)).toEqual(['First', 'Renamed']);
    const renamedExplorer = onExplorerChange.mock.calls.at(-1)?.[0];
    expect(renamedExplorer.tabs.map((tab: { output: string }) => tab.output)).toEqual(['First', 'Renamed']);
    rerender(<GuidedBuilder disabled={false} explorer={renamedExplorer} onExplorerChange={onExplorerChange} onPreview={jest.fn()} onRecipeChange={onRecipeChange} organization="acme" project="study" recipe={renamed} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^duplicate$/i })[0]);
    const duplicatedRecipe = onRecipeChange.mock.calls.at(-1)?.[0];
    const duplicatedExplorerDocument = onExplorerChange.mock.calls.at(-1)?.[0];
    rerender(<GuidedBuilder disabled={false} explorer={duplicatedExplorerDocument} onExplorerChange={onExplorerChange} onPreview={jest.fn()} onRecipeChange={onRecipeChange} organization="acme" project="study" recipe={duplicatedRecipe} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /renamed copy/i }).length).toBeGreaterThan(0));
    const duplicatedExplorer = onExplorerChange.mock.calls.at(-1)?.[0];
    expect(duplicatedExplorer.tabs.find((tab: { output: string }) => tab.output === 'Renamed_copy').table.columns).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    const deleted = onRecipeChange.mock.calls.at(-1)?.[0];
    expect(deleted.outputs.map((output: { name: string }) => output.name)).toEqual(['First', 'Renamed']);
  });

  it('hydrates an incomplete placeholder only after the recipe request has resolved', async () => {
    const onRecipeChange = jest.fn();
    const onExplorerChange = jest.fn();
    const { rerender } = render(
      <GuidedBuilder
        disabled={false}
        explorer={{ schemaVersion: 1, tabs: [] }}
        onExplorerChange={onExplorerChange}
        onPreview={jest.fn()}
        onRecipeChange={onRecipeChange}
        organization="acme"
        project="study"
        recipe={{}}
      />,
    );
    await waitFor(() => expect(screen.getByText(/resource types found/i)).toBeInTheDocument());
    expect(onRecipeChange).not.toHaveBeenCalled();

    rerender(
      <GuidedBuilder
        disabled={false}
        explorer={{ schemaVersion: 1, tabs: [{ id: 'overview', title: 'Overview', output: 'Overview', table: { columns: [] } }] }}
        onExplorerChange={onExplorerChange}
        onPreview={jest.fn()}
        onRecipeChange={onRecipeChange}
        organization="acme"
        project="study"
        recipe={{ recipeSchemaVersion: 1, outputs: [{ name: 'Overview' }] }}
        recipeSource="platform-default"
      />,
    );

    await waitFor(() => expect(onRecipeChange).toHaveBeenCalled());
    const hydrated = onRecipeChange.mock.calls.at(-1)?.[0];
    expect(hydrated.outputs).toHaveLength(1);
    expect(hydrated.outputs[0]).toEqual(expect.objectContaining({
      name: 'Default_Explorer',
      rootResourceType: 'Patient',
      fields: expect.arrayContaining([expect.objectContaining({ name: 'id' })]),
    }));
  });

  it('edits and reorders column headers directly on rendered sample rows', async () => {
    const onRecipeChange = jest.fn();
    const onExplorerChange = jest.fn();
    const recipe = {
      recipeSchemaVersion: 1,
      outputs: [{
        name: 'People',
        rootResourceType: 'Patient',
        rowGrain: 'patient',
        fields: [{ name: 'id', expr: { select: 'root.id' } }],
        traversals: [{
          name: 'subject_Condition',
          toResourceType: 'Condition',
          alias: 'condition',
          matchMode: 'OPTIONAL',
          fields: [{ name: 'code', expr: { select: 'condition.code' } }],
        }],
      }],
    };
    const explorer = {
      schemaVersion: 1,
      tabs: [{
        id: 'people',
        title: 'People',
        output: 'People',
        table: { columns: [
          { field: 'id', label: 'ID', visible: true },
          { field: 'condition__code', label: 'Condition', visible: true },
        ] },
      }],
    };
    const preview = {
      output: 'People',
      columns: [{ name: 'id' }, { name: 'condition__code' }] as never,
      rows: [{ id: 'patient-1', condition__code: 'C50.9' }],
      rowCount: 1,
      validation: { diagnostics: [], outputs: [] },
    };
    const props = { disabled: false, onExplorerChange, onPreview: jest.fn(), onRecipeChange, organization: 'acme', project: 'study', preview, previewOutput: 'People', previewStatus: 'ready' as const };
    const { rerender } = render(<GuidedBuilder {...props} explorer={explorer} recipe={recipe} />);

    await waitFor(() => expect(screen.getByRole('navigation', { name: /locked traversal/i })).toHaveTextContent(/people.*diagnoses and conditions/i));
    renderTable();
    expect(await screen.findByText('patient-1')).toBeInTheDocument();
    expect(screen.getByText('C50.9')).toBeInTheDocument();
    const conditionHeader = screen.getByRole('textbox', { name: /column condition__code display name/i });
    fireEvent.change(conditionHeader, { target: { value: 'Diagnosis' } });
    const labeledExplorer = onExplorerChange.mock.calls.at(-1)?.[0];
    expect(labeledExplorer.tabs[0].table.columns[1].label).toBe('Diagnosis');
    rerender(<GuidedBuilder {...props} explorer={labeledExplorer} recipe={recipe} />);
    fireEvent.click(screen.getByRole('button', { name: /move diagnosis left/i }));
    const reorderedExplorer = onExplorerChange.mock.calls.at(-1)?.[0];
    rerender(<GuidedBuilder {...props} explorer={reorderedExplorer} recipe={recipe} />);

    expect(reorderedExplorer.tabs[0].table.columns[0].field).toBe('condition__code');
    expect(screen.getByRole('textbox', { name: /column condition__code display name/i })).toHaveValue('Diagnosis');
  });

  it('states clearly when the live project scan has no populated resources', async () => {
    const scan = (jest.requireMock('./fhirProjectMap') as { scanFhirProjectMap: jest.Mock }).scanFhirProjectMap;
    scan.mockResolvedValueOnce({ nodes: [], edges: [] });
    render(<GuidedBuilder disabled={false} explorer={{ schemaVersion: 1, tabs: [] }} onExplorerChange={jest.fn()} onPreview={jest.fn()} onRecipeChange={jest.fn()} organization="acme" project="empty" recipe={{}} />);
    expect(await screen.findByText(/No populated FHIR resources were found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new table/i })).toBeDisabled();
  });

  it('uses the graph itself to choose the row root without a separate rows selector', async () => {
    const onRecipeChange = jest.fn();
    render(<GuidedBuilder disabled={false} explorer={{ schemaVersion: 1, tabs: [] }} onExplorerChange={jest.fn()} onPreview={jest.fn()} onRecipeChange={onRecipeChange} organization="acme" project="study" recipe={{}} recipeSource="platform-default" />);

    await openNodeInspector('Condition');
    expect(screen.queryByLabelText(/rows represent/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start each row with diagnoses/i }));

    await waitFor(() => expect(onRecipeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outputs: expect.arrayContaining([
          expect.objectContaining({ rootResourceType: 'Condition' }),
        ]),
      }),
    ));
  });

  it('keeps sparse relationships out of the primary graph until requested', async () => {
    render(<GuidedBuilder disabled={false} explorer={{ schemaVersion: 1, tabs: [] }} onExplorerChange={jest.fn()} onPreview={jest.fn()} onRecipeChange={jest.fn()} organization="acme" project="study" recipe={{}} recipeSource="platform-default" />);

    await screen.findByText(/resource types found/i);
    expect(screen.queryByRole('button', { name: /subject_Patient.*1/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /show sparse relationships/i }));
    expect(await screen.findByRole('button', { name: /subject_Patient.*1/i })).toBeInTheDocument();
  });
});
