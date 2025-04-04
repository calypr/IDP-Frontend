import { useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { UnstyledButton, Text, Box, TextInput } from '@mantine/core';
import { Column } from './column';
import { GraphQLAutocomplete } from './graphqlAutoComplete';
import { GraphQLSchema } from 'graphql';

import {
  type FilterUnitProps,
  type ColumnKey,
  type FlexibleColumns,
  type ChartItem,
  type TableItem,
} from './types';

export const FilterUnit = <T extends 'table' | 'filters' | 'charts'>({
  tabId,
  columns,
  setColumns,
  type,
  schema,
  tabType,
  title,
}: FilterUnitProps<T>) => {
  const [fieldName, setFieldName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [chartType, setChartType] = useState('');
  const [lastInsertColumn, setLastInsertColumn] = useState<ColumnKey>('col4');

  const distributeItems = (items: any[]) => {
    const columns: FlexibleColumns = {
      col1: [],
      col2: [],
      col3: [],
      col4: [],
    };
    items.forEach((item, i) => {
      const colKey = `col${(i % 4) + 1}` as keyof FlexibleColumns;
      columns[colKey].push(item);
    });
    return columns;
  };

  const submitData = () => {
    if (!fieldName || !labelName || (type === 'charts' && !chartType)) {
      return;
    }

    const newEntry = { id: Date.now() } as T extends 'charts'
      ? ChartItem
      : TableItem;
    if (type === 'charts') {
      (newEntry as ChartItem).field = fieldName;
      (newEntry as ChartItem).title = labelName;
      (newEntry as ChartItem).chartType = chartType;
    } else {
      (newEntry as TableItem).field = fieldName;
      (newEntry as TableItem).label = labelName;
    }

    const currentItems = [
      ...columns.col1,
      ...columns.col2,
      ...columns.col3,
      ...columns.col4,
    ];

    const updatedItems = [...currentItems, newEntry];
    const newColumns = distributeItems(updatedItems);

    setColumns(newColumns);
    setLastInsertColumn(
      `col${((updatedItems.length - 1) % 4) + 1}` as ColumnKey,
    );
    setFieldName('');
    setLabelName('');
    setChartType('');
  };

  const removeData = (tabId: string | number, entryId: number) => {
    const columnOrder = ['col1', 'col2', 'col3', 'col4'] as const;
    const flatItems: (TableItem | ChartItem)[] = [];
    let removedColId: keyof FlexibleColumns | null = null;

    const maxLength = Math.max(
      ...Object.values(columns).map((col) => col.length),
    );
    for (let i = 0; i < maxLength; i++) {
      columnOrder.forEach((colId) => {
        const key = colId as keyof FlexibleColumns;
        if (columns[key][i]) {
          if (columns[key][i].id === entryId) {
            removedColId = key;
          } else {
            flatItems.push(columns[key][i]);
          }
        }
      });
    }

    if (removedColId) {
      const newColumns: FlexibleColumns = {
        col1: [],
        col2: [],
        col3: [],
        col4: [],
      };
      flatItems.forEach((item, index) => {
        const colIndex = index % 4;
        const colId = columnOrder[colIndex] as keyof FlexibleColumns;
        newColumns[colId].push(item);
      });
      setColumns(newColumns);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const [, sourceColId] = source.droppableId.split('-');
    const [, destColId] = destination.droppableId.split('-');

    const columnOrder = ['col1', 'col2', 'col3', 'col4'];
    const flatItems: (TableItem | ChartItem)[] = [];
    const maxLength = Math.max(
      ...Object.values(columns).map((col) => col.length),
    );
    for (let i = 0; i < maxLength; i++) {
      columnOrder.forEach((colId) => {
        const key = colId as keyof FlexibleColumns;
        if (columns[key][i]) {
          flatItems.push(columns[key][i]); // Correct access using key
        }
      });
    }

    const sourceFlatIndex = columnOrder.indexOf(sourceColId) + source.index;
    const destFlatIndex = columnOrder.indexOf(destColId) + destination.index;

    const [movedItem] = flatItems.splice(sourceFlatIndex, 1);
    flatItems.splice(destFlatIndex, 0, movedItem);

    const newColumns: FlexibleColumns = {
      col1: [],
      col2: [],
      col3: [],
      col4: [],
    };
    flatItems.forEach((item, index) => {
      const colIndex = index % 4;
      const colId = columnOrder[colIndex] as keyof FlexibleColumns;
      newColumns[colId].push(item);
    });

    setColumns(newColumns);
  };

  return (
    <div>
      <Text className="text-start mb-2">{title}</Text>
      <Box className="flex items-start space-x-4 mb-4 w-full overflow-scroll">
        <Box className="flex items-center space-x-4">
          <UnstyledButton
            onClick={submitData}
            className="px-6 py-3 text-white bg-primary rounded-md hover:bg-secondary active:scale-95"
          >
            Add
          </UnstyledButton>
          <Box className="flex flex-col space-y-2 min-w-[300px]">
            <GraphQLAutocomplete
              value={fieldName}
              onChange={setFieldName}
              placeholder="Enter field name (db name)"
              schema={schema as GraphQLSchema}
              context="fieldName"
              tabType={tabType}
            />
            <TextInput
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder={
                type === 'table'
                  ? 'Enter title (label name)'
                  : 'Enter label name'
              }
              className="w-full"
            />
            {type === 'charts' && (
              <TextInput
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                placeholder="Enter chart type (e.g: fullPie, bar or donut )"
                className="w-full"
              />
            )}
          </Box>
        </Box>
        <DragDropContext onDragEnd={onDragEnd}>
          <Box className="flex bg-gray-100 p-3 rounded-lg space-x-3">
            {Object.entries(columns).map(([colId, items]) => (
              <Column
                key={colId}
                columnId={colId}
                items={items}
                removeData={removeData}
                tabId={tabId}
                type={type}
              />
            ))}
          </Box>
        </DragDropContext>
      </Box>
    </div>
  );
};
