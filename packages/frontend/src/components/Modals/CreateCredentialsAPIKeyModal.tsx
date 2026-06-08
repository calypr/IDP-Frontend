import React from 'react';
import { Text } from '@mantine/core';
import { BaseModal } from './BaseModal';
import FileSaver from 'file-saver';
import { APICredentials } from '../Profile/types';
import { LoadingOverlay } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';

export const saveToFile = (
  savingStr: string,
  filename = 'credentials.json',
) => {
  const blob = new Blob([savingStr], { type: 'text/json' });

  if ('showSaveFilePicker' in window) {
    return (window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: Array<{
          accept: Record<string, Array<string>>;
          description: string;
        }>;
      }) => Promise<{
        createWritable: () => Promise<{
          close: () => Promise<void>;
          write: (data: Blob) => Promise<void>;
        }>;
      }>;
    })
      .showSaveFilePicker?.({
        suggestedName: filename,
        types: [
          {
            accept: {
              'application/json': ['.json'],
            },
            description: 'JSON Files',
          },
        ],
      })
      .then(async (handle) => {
        if (!handle) return;
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      })
      .catch((error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          error.name === 'AbortError'
        ) {
          return;
        }

        FileSaver.saveAs(blob, filename);
      });
  }

  FileSaver.saveAs(blob, filename);
};

interface CreateCredentialsAPIKeyModalProps {
  openModal: boolean;
  credentials: APICredentials;
}

/**
 * Creates a specialized modal that is a parto of the Credentials component on the profile page
 * @param openModal - State tracking to keep track of wether the modal should be shown or hidden
 * @param credentials - The new fence credential that is to be shown in the modal
 */
export const CreateCredentialsAPIKeyModal = ({
  openModal,
  credentials,
}: CreateCredentialsAPIKeyModalProps): JSX.Element => {
  const clipboard = useClipboard({ timeout: 500 });
  const canUseSavePicker =
    typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  const copyToClipboard = (credentials: APICredentials) => {
    clipboard.copy(JSON.stringify(credentials));
  };

  return (
    <BaseModal
      title={
        <Text size="lg" className="font-medium font-heading">
          Created API Key
        </Text>
      }
      openModal={openModal}
      size="60%"
      leftButtons={[
        {
          title: 'Close',
          hideModalOnClick: true,
          dataTestId: 'button-create-api-key-close',
        },
      ]}
      buttons={[
        {
          title: canUseSavePicker ? 'Save As...' : 'Download',
          hideModalOnClick: false,
          dataTestId: 'button-create-api-key-download',
          onClick: () => {
            void saveToFile(JSON.stringify(credentials), 'credentials.json');
          },
        },
        {
          title: 'Copy',
          hideModalOnClick: false,
          dataTestId: 'button-create-api-key-copy',
          onClick: () => {
            copyToClipboard(credentials);
          },
        },
      ]}
      withCloseButton={true}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <div className="flex flex-col border-y border-y-base-darker py-4 space-y-4 font-content">
        {
          credentials.api_key === '' && <LoadingOverlay visible={true} /> // pragma: allowlist-secret;
        }
        <p>
          This key is only shown once. Please copy or save it and store it in a
          safe place.
        </p>
        <p>
          {canUseSavePicker
            ? 'Save As... opens your system save dialog so you can choose where to store the credentials file.'
            : 'This browser does not support the system Save As picker here, so clicking Download will use the browser download flow instead.'}
        </p>
        <div>
          <strong>Recommended path:</strong> <code>~/.gen3/credentials.json</code>
        </div>
        <div>
          <strong>Key ID:</strong> {credentials.key_id}
        </div>
        <div>
          <strong>API Key:</strong> {credentials.api_key.replace(/./g, '*')}
        </div>
      </div>
    </BaseModal>
  );
};
