import React from 'react';
import { fieldNameToTitle } from '@gen3/core';
import { Paper, Table, Text } from '@mantine/core';

type SimpleTableProps = {
  data: Record<string, string>;
};

// table component with only one row where
// headers are the keys of the data object
const SimpleTable = ({ data }: SimpleTableProps) => {
  if (!data) return null;

  const headers = Object.keys(data);

  return (
    <Paper withBorder className="w-full">
      <Table withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            {headers.map((key) => (
              <Table.Th key={key}>{fieldNameToTitle(key)}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr key="0">
            {headers.map((key) => (
              <Table.Td key={key}>
                <Text>{data[key]}</Text>
              </Table.Td>
            ))}
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Paper>
  );
};

export default SimpleTable;
