import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExplorerViewBuilder } from './ExplorerViewBuilder';

let mockPrincipal = 'user-a';
const mockDispatch = jest.fn();
const mockInvalidateTags = jest.fn((..._args: unknown[]) => 'INVALIDATE_SAVED_VIEWS');
const mockInvalidateProjectViewBuilder = jest.fn((project: string) =>
  mockInvalidateTags([{ type: 'LOOM_EXPLORER_AUTHORING', id: project }]),
);

jest.mock('@gen3/core', () => ({
  selectUserDetails: jest.fn(),
  useCoreSelector: () => ({ sub: mockPrincipal }),
  useCoreDispatch: () => mockDispatch,
}));

jest.mock('./authenticatedLoomClient', () => ({
  useAuthenticatedLoomClient: () => ({}),
}));

jest.mock('./projectViewBuilderApi', () => ({
  invalidateProjectViewBuilder: (project: string) => mockInvalidateProjectViewBuilder(project),
}));

jest.mock('@calypr/loom-ui/saved-views', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    LoomSavedViewBuilder: ({ onSaved }: { readonly onSaved?: () => void }) => {
      const [count, setCount] = React.useState(0);
      return React.createElement('div', {},
        React.createElement(
          'button',
          { type: 'button', onClick: () => setCount((value) => value + 1) },
          `Saved view edits: ${count}`,
        ),
        React.createElement('button', { type: 'button', onClick: onSaved }, 'Save view'),
      );
    },
  };
});

it('resets saved-view editor state when the authenticated principal changes', () => {
  mockDispatch.mockReset();
  mockInvalidateTags.mockReset();
  mockInvalidateProjectViewBuilder.mockClear();
  mockInvalidateTags.mockReturnValue('INVALIDATE_SAVED_VIEWS');
  mockPrincipal = 'user-a';
  const props = {
    project: 'HTAN_INT/BForePC',
    onSelectConfig: jest.fn(),
    viewHref: '/Explorer/HTAN_INT%2FBForePC',
  };
  const { rerender } = render(<ExplorerViewBuilder {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved view edits: 0' }));
  expect(screen.getByRole('button', { name: 'Saved view edits: 1' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
  expect(mockInvalidateProjectViewBuilder).toHaveBeenCalledWith(props.project);
  expect(mockInvalidateTags).toHaveBeenCalledWith([
    { type: 'LOOM_EXPLORER_AUTHORING', id: props.project },
  ]);
  expect(mockDispatch).toHaveBeenCalledWith('INVALIDATE_SAVED_VIEWS');

  mockPrincipal = 'user-b';
  rerender(<ExplorerViewBuilder {...props} />);
  expect(screen.getByRole('button', { name: 'Saved view edits: 0' })).toBeInTheDocument();
});
