import { BaseModal } from '@gen3/frontend';
import React, { useState } from 'react';
import { Button, Text } from '@mantine/core';
import { AssociatedAssaysTable } from './AssociatedFiles';

export const TimeSeriesAssaySummaryModal = ({
  identifiers,
  //IdentifierIndexdDaysMap,
}: {
  identifiers: string[];
  //IdentifierIndexdDaysMap: Record<string, any>;
}): JSX.Element => {
  const [openModal, setOpenModal] = useState(false); // Track modal state

  return (
    <React.Fragment>
      <Button onClick={() => setOpenModal(true)}>Open Assay Summary</Button>
      <BaseModal
        title={
          <Text size="lg" className="font-medium font-heading">
            Time Series Assay Results
          </Text>
        }
        openModal={openModal}
        onClose={() => setOpenModal(false)}
        size="80%"
        buttons={[
          {
            title: 'Close',
            onClick: () => setOpenModal(false),
            hideModalOnClick: true,
            dataTestId: 'button-close-assay-summary-table',
          },
        ]}
        withCloseButton={true}
        closeOnClickOutside={true}
      >
        <AssociatedAssaysTable
          identifiers={identifiers}
          asoc_val={'specimen_indexed_collection_date_days'}
        />
      </BaseModal>
    </React.Fragment>
  );
};
