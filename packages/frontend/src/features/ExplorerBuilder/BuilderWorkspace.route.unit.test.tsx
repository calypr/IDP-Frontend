import React from 'react';
import { render, waitFor } from '@testing-library/react';
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

const mutationResult = () => [jest.fn(), { isLoading: false }];

describe('BuilderWorkspace route selection', () => {
  beforeEach(() => {
    (useGetExplorerAuthoringExplorersQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      refetch: jest.fn(),
    });
    (useGetExplorerBuilderStateV2Query as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: jest.fn(),
    });
    (useGetExplorerAuthoringCapabilityV2Query as jest.Mock).mockReturnValue({
      data: undefined,
    });
    (useCreateExplorerAuthoringMutation as jest.Mock).mockReturnValue(
      mutationResult(),
    );
    (useDeleteExplorerAuthoringMutation as jest.Mock).mockReturnValue(
      mutationResult(),
    );
    (useApplyExplorerBuilderCommandsV2Mutation as jest.Mock).mockReturnValue(
      mutationResult(),
    );
    (useReconcileExplorerBuilderV2Mutation as jest.Mock).mockReturnValue(
      mutationResult(),
    );
    (useGetExplorerCandidateSuggestionsV2Mutation as jest.Mock).mockReturnValue(
      mutationResult(),
    );
    (usePreviewExplorerAuthoringV2Mutation as jest.Mock).mockReturnValue(
      mutationResult(),
    );
    (usePublishExplorerAuthoringV2Mutation as jest.Mock).mockReturnValue(
      mutationResult(),
    );
  });

  it('requests the Explorer named by the route instead of default', () => {
    render(
      <BuilderWorkspace
        organization="HTAN_INT"
        project="BForePC"
        explorerId="test"
      />,
    );

    expect(useGetExplorerBuilderStateV2Query).toHaveBeenCalledWith({
      project: 'HTAN_INT/BForePC',
      explorerId: 'test',
      authResourcePath: '/programs/HTAN_INT/projects/BForePC',
    });
  });

  it('tracks a new Explorer when client-side navigation changes the query', async () => {
    const view = render(
      <BuilderWorkspace
        organization="HTAN_INT"
        project="BForePC"
        explorerId="first"
      />,
    );

    view.rerender(
      <BuilderWorkspace
        organization="HTAN_INT"
        project="BForePC"
        explorerId="second"
      />,
    );

    await waitFor(() =>
      expect(useGetExplorerBuilderStateV2Query).toHaveBeenLastCalledWith({
        project: 'HTAN_INT/BForePC',
        explorerId: 'second',
        authResourcePath: '/programs/HTAN_INT/projects/BForePC',
      }),
    );
  });
});
