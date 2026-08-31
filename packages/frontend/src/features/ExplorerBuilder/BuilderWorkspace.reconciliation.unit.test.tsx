import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  useApplyExplorerBuilderCommandsV2Mutation,
  useCreateExplorerAuthoringMutation,
  useDeleteExplorerAuthoringMutation,
  useGetExplorerAuthoringCapabilityV2Query,
  useGetExplorerAuthoringExplorersQuery,
  useGetExplorerBuilderStateV2Query,
  useGetExplorerCandidateSuggestionsV2Mutation,
  usePreviewExplorerAuthoringV2Mutation,
  usePublishExplorerAuthoringV2Mutation,
  useReconcileExplorerBuilderV2Mutation,
} from '@gen3/core';
import BuilderWorkspace from './BuilderWorkspace';

jest.mock('@gen3/core', () => ({
  useApplyExplorerBuilderCommandsV2Mutation: jest.fn(),
  useCreateExplorerAuthoringMutation: jest.fn(),
  useDeleteExplorerAuthoringMutation: jest.fn(),
  useGetExplorerAuthoringCapabilityV2Query: jest.fn(),
  useGetExplorerAuthoringExplorersQuery: jest.fn(),
  useGetExplorerBuilderStateV2Query: jest.fn(),
  useGetExplorerCandidateSuggestionsV2Mutation: jest.fn(),
  usePreviewExplorerAuthoringV2Mutation: jest.fn(),
  usePublishExplorerAuthoringV2Mutation: jest.fn(),
  useReconcileExplorerBuilderV2Mutation: jest.fn(),
}));

jest.mock('./components/BuilderToolbar', () => ({
  BuilderToolbar: ({
    onPreview,
    onPublish,
    previewDisabled,
    publishDisabled,
  }: {
    readonly onPreview: () => void;
    readonly onPublish: () => void;
    readonly previewDisabled: boolean;
    readonly publishDisabled: boolean;
  }) => (
    <div>
      <button type="button" disabled={previewDisabled} onClick={onPreview}>
        Preview
      </button>
      <button type="button" disabled={publishDisabled} onClick={onPublish}>
        Publish
      </button>
    </div>
  ),
}));

jest.mock('./components/GuidedGraphWorkspace', () => ({
  GuidedGraphWorkspace: () => <div>Graph</div>,
}));

jest.mock('./components/ColumnSelector', () => ({
  ColumnSelector: ({
    onChange,
  }: {
    readonly onChange: (value: unknown) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          column: 'specimen_identifier',
          label: 'Updated specimen identifier',
          occurrenceId: 'base',
          source: {
            kind: 'field',
            fieldPath: 'identifier[].value',
            projectionMode: 'FIRST',
          },
          table: { visible: true, order: 0 },
        })
      }
    >
      Save column change
    </button>
  ),
}));

jest.mock('./components/PreviewTable', () => ({
  PreviewTable: () => <div>Preview table</div>,
}));

const apiVersion = 'loom.calypr.org/explorer-authoring/v2' as const;
const column = {
  column: 'specimen_identifier',
  label: 'Specimen identifier',
  occurrenceId: 'base',
  source: {
    kind: 'field' as const,
    fieldPath: 'identifier[].value',
    projectionMode: 'FIRST',
  },
  table: { visible: true, order: 0 },
};
const workspace = {
  apiVersion,
  kind: 'ExplorerBuilderWorkspace' as const,
  explorer: { title: 'Test Explorer' },
  documents: [
    {
      kind: 'ExplorerBuilderDocument' as const,
      output: { id: 'specimens', title: 'Specimens' },
      rootResourceType: 'Specimen',
      route: { occurrenceId: 'base', resourceType: 'Specimen' },
      columns: [column],
    },
  ],
  tabs: [
    {
      id: 'specimens-tab',
      title: 'Specimens',
      outputId: 'specimens',
      order: 0,
      visible: true,
    },
  ],
};
const catalog = {
  snapshotToken: 'snapshot-1',
  generation: 'generation-1',
  routePolicy: { allowRepeatedEdges: false, allowSelfLoops: false },
  nodes: [
    {
      nodeId: 'specimen-node',
      resourceType: 'Specimen',
      rowRootEligible: true,
      populated: true,
      documentCount: 1,
    },
  ],
  edges: [],
  candidates: [
    {
      candidateId: 'specimen-id',
      nodeId: 'specimen-node',
      fieldPath: 'identifier[].value',
      label: 'Specimen identifier',
      logicalType: 'string',
      projectionModes: ['FIRST'],
      defaultProjectionMode: 'FIRST',
      filterable: true,
      chartable: false,
    },
  ],
};
const builderState = {
  apiVersion,
  kind: 'ExplorerBuilderState' as const,
  lifecycleState: 'READY' as const,
  draftVersion: 1,
  draftDigest: 'sha256:draft-1',
  workspace,
  catalog,
};
const receipt = {
  apiVersion,
  kind: 'ExplorerBuilderReceipt' as const,
  receiptId: 'receipt-1',
  snapshotToken: 'snapshot-1',
  builder: workspace,
  outputs: [
    {
      outputId: 'specimens',
      columns: [
        {
          column: 'specimen_identifier',
          label: 'Specimen identifier',
          logicalType: 'string',
          filterable: true,
          chartable: false,
        },
      ],
    },
  ],
  diagnostics: [],
};

const resolvedRequest = <T,>(value: T) => ({
  unwrap: jest.fn().mockResolvedValue(value),
  abort: jest.fn(),
});

describe('BuilderWorkspace on-demand reconciliation', () => {
  let applyCommands: jest.Mock;
  let reconcile: jest.Mock;
  let preview: jest.Mock;
  let publish: jest.Mock;

  beforeEach(() => {
    applyCommands = jest.fn().mockReturnValue(
      resolvedRequest({
        commandId: 'command-1',
        workspace,
        draftVersion: 2,
        draftDigest: 'sha256:draft-2',
        results: [
          {
            type: 'TABLE_CHANGED',
            outputId: 'specimens',
            column: 'specimen_identifier',
          },
        ],
        diagnostics: [],
      }),
    );
    reconcile = jest.fn().mockReturnValue(resolvedRequest(receipt));
    preview = jest.fn().mockReturnValue(
      resolvedRequest({
        apiVersion,
        kind: 'ExplorerBuilderPreview',
        receiptId: 'receipt-1',
        outputId: 'specimens',
        columns: receipt.outputs[0].columns,
        rows: [],
        rowCount: 0,
        diagnostics: [],
      }),
    );
    publish = jest.fn().mockReturnValue(resolvedRequest({}));

    (useGetExplorerAuthoringExplorersQuery as jest.Mock).mockReturnValue({
      data: [{ explorerId: 'test', title: 'Test Explorer' }],
      isLoading: false,
      refetch: jest.fn(),
    });
    (useGetExplorerBuilderStateV2Query as jest.Mock).mockReturnValue({
      data: builderState,
      isLoading: false,
      refetch: jest.fn(),
    });
    (useGetExplorerAuthoringCapabilityV2Query as jest.Mock).mockReturnValue({
      data: { features: { deleteExplorer: false } },
    });
    (useApplyExplorerBuilderCommandsV2Mutation as jest.Mock).mockReturnValue([
      applyCommands,
      { isLoading: false },
    ]);
    (useReconcileExplorerBuilderV2Mutation as jest.Mock).mockReturnValue([
      reconcile,
      { isLoading: false },
    ]);
    (usePreviewExplorerAuthoringV2Mutation as jest.Mock).mockReturnValue([
      preview,
      { isLoading: false },
    ]);
    (usePublishExplorerAuthoringV2Mutation as jest.Mock).mockReturnValue([
      publish,
      { isLoading: false },
    ]);
    (useCreateExplorerAuthoringMutation as jest.Mock).mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
    (useDeleteExplorerAuthoringMutation as jest.Mock).mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
    (useGetExplorerCandidateSuggestionsV2Mutation as jest.Mock).mockReturnValue(
      [jest.fn(), { isLoading: false }],
    );
  });

  it('does not reconcile a hydrated draft until Preview requests a receipt', async () => {
    render(
      <BuilderWorkspace
        organization="HTAN_INT"
        project="BForePC"
        explorerId="test"
      />,
    );

    const previewButton = await screen.findByRole('button', {
      name: 'Preview',
    });
    await waitFor(() => expect(previewButton).toBeEnabled());
    expect(reconcile).not.toHaveBeenCalled();

    fireEvent.click(previewButton);

    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
  });

  it('saves commands without reconciling, then reconciles once before Publish', async () => {
    render(
      <BuilderWorkspace
        organization="HTAN_INT"
        project="BForePC"
        explorerId="test"
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Save column change' }),
    );
    await waitFor(() => expect(applyCommands).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled(),
    );
    expect(reconcile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
  });

  it('previews after one click when reconciliation returns a normalized builder', async () => {
    reconcile.mockReturnValue(
      resolvedRequest({
        ...receipt,
        builder: {
          ...workspace,
          sharedFilters: {
            identifier: [
              { outputId: 'specimens', column: 'specimen_identifier' },
            ],
          },
        },
      }),
    );

    render(
      <BuilderWorkspace
        organization="HTAN_INT"
        project="BForePC"
        explorerId="test"
      />,
    );

    const previewButton = await screen.findByRole('button', {
      name: 'Preview',
    });
    await waitFor(() => expect(previewButton).toBeEnabled());
    fireEvent.click(previewButton);

    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
  });
});
