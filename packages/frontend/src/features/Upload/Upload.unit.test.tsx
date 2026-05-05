import React from 'react';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Upload from './Upload';

jest.mock('../../components/Protected/ProtectedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const startUploadMock = jest.fn(async () => undefined);
const addFilesMock = jest.fn();
const downloadItemMock = jest.fn(async () => undefined);
const removeItemMock = jest.fn();
const clearFinishedItemsMock = jest.fn();
const setSelectedOrganizationMock = jest.fn();
const setSelectedProjectMock = jest.fn();
const setSubdirectoryMock = jest.fn();

jest.mock('./useUploadController', () => ({
  useUploadController: jest.fn(),
}));

const { useUploadController } = jest.requireMock('./useUploadController') as {
  useUploadController: jest.Mock;
};

const renderUpload = () =>
  render(
    <MantineProvider>
      <Upload />
    </MantineProvider>,
  );

describe('<Upload />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUploadController.mockReturnValue({
      addFiles: addFilesMock,
      canStartUpload: false,
      clearFinishedItems: clearFinishedItemsMock,
      hasBuckets: true,
      isBucketsLoading: false,
      isOrganizationSelectionRequired: false,
      isProjectSelectionRequired: false,
      isUploading: false,
      organizationOptions: [],
      projectOptions: [],
      queue: [],
      downloadItem: downloadItemMock,
      removeItem: removeItemMock,
      selectedOrganization: '',
      selectedProject: '',
      setSelectedOrganization: setSelectedOrganizationMock,
      setSelectedProject: setSelectedProjectMock,
      setSubdirectory: setSubdirectoryMock,
      startUpload: startUploadMock,
      subdirectory: '',
    });
  });

  it('queues files through the file picker', async () => {
    renderUpload();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await userEvent.upload(input, file);

    expect(addFilesMock).toHaveBeenCalledWith([file]);
  });

  it('requires an organization before upload can start', () => {
    useUploadController.mockReturnValue({
      addFiles: addFilesMock,
      canStartUpload: false,
      clearFinishedItems: clearFinishedItemsMock,
      hasBuckets: true,
      isBucketsLoading: false,
      isOrganizationSelectionRequired: false,
      isProjectSelectionRequired: false,
      isUploading: false,
      organizationOptions: [{ label: 'org-a', value: 'org-a' }],
      projectOptions: [],
      queue: [
        {
          file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
          id: '1',
          progress: 0,
          status: 'queued',
          uploadedBytes: 0,
        },
      ],
      downloadItem: downloadItemMock,
      removeItem: removeItemMock,
      selectedOrganization: '',
      selectedProject: '',
      setSelectedOrganization: setSelectedOrganizationMock,
      setSelectedProject: setSelectedProjectMock,
      setSubdirectory: setSubdirectoryMock,
      startUpload: startUploadMock,
      subdirectory: '',
    });

    renderUpload();

    expect(screen.getByText('Organization required')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Upload Files' }),
    ).toBeDisabled();
  });

  it('renders queued file state and progress rows', () => {
    useUploadController.mockReturnValue({
      addFiles: addFilesMock,
      canStartUpload: true,
      clearFinishedItems: clearFinishedItemsMock,
      hasBuckets: true,
      isBucketsLoading: false,
      isOrganizationSelectionRequired: false,
      isProjectSelectionRequired: false,
      isUploading: false,
      organizationOptions: [{ label: 'org-a', value: 'org-a' }],
      projectOptions: [],
      queue: [
        {
          file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
          id: '1',
          objectId: 'dg.mock/1',
          objectKey: 'nested/hello.txt',
          progress: 42,
          status: 'uploading',
          uploadedBytes: 2,
        },
      ],
      downloadItem: downloadItemMock,
      removeItem: removeItemMock,
      selectedOrganization: 'org-a',
      selectedProject: '',
      setSelectedOrganization: setSelectedOrganizationMock,
      setSelectedProject: setSelectedProjectMock,
      setSubdirectory: setSubdirectoryMock,
      startUpload: startUploadMock,
      subdirectory: 'nested',
    });

    renderUpload();

    expect(screen.getByText('hello.txt')).toBeInTheDocument();
    expect(screen.getByText('nested/hello.txt')).toBeInTheDocument();
    expect(screen.getByText('Uploading')).toBeInTheDocument();
    expect(screen.getByText('dg.mock/1')).toBeInTheDocument();
  });

  it('passes subdirectory edits back to the controller', async () => {
    renderUpload();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Subdirectory' }),
      'nested/path',
    );

    expect(setSubdirectoryMock).toHaveBeenCalled();
  });

  it('wires the download and delete row actions', async () => {
    useUploadController.mockReturnValue({
      addFiles: addFilesMock,
      canStartUpload: true,
      clearFinishedItems: clearFinishedItemsMock,
      hasBuckets: true,
      isBucketsLoading: false,
      isOrganizationSelectionRequired: false,
      isProjectSelectionRequired: false,
      isUploading: false,
      organizationOptions: [{ label: 'org-a', value: 'org-a' }],
      projectOptions: [],
      queue: [
        {
          drsObject: { id: 'dg.mock/1' },
          file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
          id: '1',
          objectId: 'dg.mock/1',
          progress: 100,
          status: 'complete',
          uploadedBytes: 5,
        },
      ],
      downloadItem: downloadItemMock,
      removeItem: removeItemMock,
      selectedOrganization: 'org-a',
      selectedProject: '',
      setSelectedOrganization: setSelectedOrganizationMock,
      setSelectedProject: setSelectedProjectMock,
      setSubdirectory: setSubdirectoryMock,
      startUpload: startUploadMock,
      subdirectory: '',
    });

    renderUpload();

    await userEvent.click(
      screen.getByRole('button', { name: 'Download hello.txt' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove hello.txt' }),
    );

    expect(downloadItemMock).toHaveBeenCalledWith('1');
    expect(removeItemMock).toHaveBeenCalledWith('1');
  });

  it('requires a project when the selected organization exposes multiple projects', () => {
    useUploadController.mockReturnValue({
      addFiles: addFilesMock,
      canStartUpload: false,
      clearFinishedItems: clearFinishedItemsMock,
      hasBuckets: true,
      isBucketsLoading: false,
      isOrganizationSelectionRequired: false,
      isProjectSelectionRequired: true,
      isUploading: false,
      organizationOptions: [{ label: 'org-a', value: 'org-a' }],
      projectOptions: [
        { label: 'proj-a', value: 'proj-a' },
        { label: 'proj-b', value: 'proj-b' },
      ],
      queue: [
        {
          file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
          id: '1',
          progress: 0,
          status: 'queued',
          uploadedBytes: 0,
        },
      ],
      downloadItem: downloadItemMock,
      removeItem: removeItemMock,
      selectedOrganization: 'org-a',
      selectedProject: '',
      setSelectedOrganization: setSelectedOrganizationMock,
      setSelectedProject: setSelectedProjectMock,
      setSubdirectory: setSubdirectoryMock,
      startUpload: startUploadMock,
      subdirectory: '',
    });

    renderUpload();

    expect(screen.getByText('Project required')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Upload Files' }),
    ).toBeDisabled();
  });

  it('does not render the page when the user has zero accessible buckets', () => {
    useUploadController.mockReturnValue({
      addFiles: addFilesMock,
      canStartUpload: false,
      clearFinishedItems: clearFinishedItemsMock,
      hasBuckets: false,
      isBucketsLoading: false,
      isOrganizationSelectionRequired: false,
      isProjectSelectionRequired: false,
      isUploading: false,
      organizationOptions: [],
      projectOptions: [],
      queue: [],
      downloadItem: downloadItemMock,
      removeItem: removeItemMock,
      selectedOrganization: '',
      selectedProject: '',
      setSelectedOrganization: setSelectedOrganizationMock,
      setSelectedProject: setSelectedProjectMock,
      setSubdirectory: setSubdirectoryMock,
      startUpload: startUploadMock,
      subdirectory: '',
    });

    renderUpload();

    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Upload Files' }),
    ).not.toBeInTheDocument();
  });
});
