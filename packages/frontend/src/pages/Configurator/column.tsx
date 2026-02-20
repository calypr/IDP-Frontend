import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { type ColumnProps, type ChartItem, type TableItem } from './types';
import { Box, Button } from '@mantine/core';

export const Column = <T extends 'table' | 'filters' | 'charts'>({
  columnId,
  items,
  removeData,
  tabId,
  type,
}: ColumnProps<T>) => {
  const validItems = Array.isArray(items)
    ? items.filter(
        (item): item is T extends 'charts' ? ChartItem : TableItem =>
          item != null,
      )
    : [];

  const renderEntry = (entry: T extends 'charts' ? ChartItem : TableItem) => {
    if (type === 'charts') {
      const chartEntry = entry as ChartItem; // Type assertion for clarity
      return `${chartEntry.title}\n${chartEntry.field}\n${chartEntry.chartType}`;
    } else {
      const tableEntry = entry as TableItem; // Type assertion for clarity
      return `${tableEntry.label}\n${tableEntry.field}`;
    }
  };

  return (
    <Droppable droppableId={`${tabId}-${columnId}`}>
      {(provided) => (
        <Box
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="flex-1 min-w-[150px]"
        >
          {validItems.map((entry, index) => (
            <Draggable
              key={entry.id.toString()}
              draggableId={entry.id.toString()}
              index={index}
            >
              {(provided) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  className="flex items-center p-2 bg-white border border-gray-200 rounded-lg shadow-sm mb-2 mx-1 min-w-[140px]"
                >
                  <Box className="flex-grow bg-gray-100 p-2 rounded-md whitespace-pre-wrap overflow-hidden text-ellipsis">
                    {renderEntry(entry)}
                  </Box>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="gray"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeData(tabId, entry.id);
                    }}
                    className="ml-2"
                  >
                    x
                  </Button>
                </Box>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </Box>
      )}
    </Droppable>
  );
};
