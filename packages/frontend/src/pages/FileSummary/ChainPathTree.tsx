import type React from 'react';
import { ActionIcon, Button, Checkbox, Group, Stack } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { ChainPathTreeNode } from './storagePresentation';

const chainPathTreeNodeLimit = 250;

type ChainPathTreeProps = {
  readonly expandedTreeNodes: Record<string, boolean>;
  readonly nodes: Array<ChainPathTreeNode>;
  readonly pathsByParent: Map<string, Array<ChainPathTreeNode>>;
  readonly selectedPaths: Array<string>;
  readonly selectedPathsSet: Set<string>;
  readonly treeNodeLimit: Record<string, number>;
  readonly onSelectedPathsChange: (paths: Array<string>) => void;
  readonly onTreeNodeLimitChange: (
    updater: (current: Record<string, number>) => Record<string, number>,
  ) => void;
  readonly onTreeNodeToggle: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
  readonly onTogglePath: (path: string, checked: boolean) => void;
};

export const ChainPathTree = ({
  expandedTreeNodes,
  nodes,
  onSelectedPathsChange,
  onTogglePath,
  onTreeNodeLimitChange,
  onTreeNodeToggle,
  pathsByParent,
  selectedPaths,
  selectedPathsSet,
  treeNodeLimit,
}: ChainPathTreeProps): JSX.Element => {
  const renderNode = (node: ChainPathTreeNode, depth = 0): React.ReactNode => {
    const descendantLeafPaths = node.descendantLeafPaths;
    const selectedCount = descendantLeafPaths.filter((value) =>
      selectedPathsSet.has(value),
    ).length;
    const fullySelected =
      descendantLeafPaths.length > 0 &&
      selectedCount === descendantLeafPaths.length;
    const partiallySelected =
      selectedCount > 0 && selectedCount < descendantLeafPaths.length;
    const isLeaf = !node.isFolder;
    const isExpanded = expandedTreeNodes[node.path] ?? false;
    const children = pathsByParent.get(node.path) ?? [];

    return (
      <Stack gap={4} key={node.path}>
        <Group gap="xs" style={{ paddingLeft: depth * 16 }}>
          {isLeaf ? (
            <div style={{ width: 28 }} />
          ) : (
            <ActionIcon
              onClick={() =>
                onTreeNodeToggle((current) => ({
                  ...current,
                  [node.path]: !current[node.path],
                }))
              }
              size="sm"
              variant="subtle"
            >
              <IconChevronRight
                size={14}
                style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 120ms ease',
                }}
              />
            </ActionIcon>
          )}
          <Checkbox
            checked={fullySelected}
            indeterminate={partiallySelected}
            label={node.label}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              if (isLeaf && node.leafPath) {
                onTogglePath(node.leafPath, checked);
                return;
              }
              let nextSelected: Array<string>;
              if (checked) {
                nextSelected = Array.from(
                  new Set([...selectedPaths, ...descendantLeafPaths]),
                ).sort();
              } else {
                const descendantSet = new Set(descendantLeafPaths);
                nextSelected = selectedPaths.filter(
                  (path) => !descendantSet.has(path),
                );
              }
              onSelectedPathsChange(nextSelected);
            }}
          />
        </Group>
        {!isLeaf && isExpanded ? (
          <>
            {children
              .slice(0, treeNodeLimit[node.path] ?? chainPathTreeNodeLimit)
              .map((child) => renderNode(child, depth + 1))}
            {children.length >
              (treeNodeLimit[node.path] ?? chainPathTreeNodeLimit) && (
              <Button
                onClick={() =>
                  onTreeNodeLimitChange((current) => ({
                    ...current,
                    [node.path]:
                      (current[node.path] ?? chainPathTreeNodeLimit) +
                      chainPathTreeNodeLimit,
                  }))
                }
                size="xs"
                style={{
                  alignSelf: 'flex-start',
                  marginLeft: (depth + 1) * 16 + 28,
                }}
                variant="subtle"
              >
                Show more (
                {(
                  children.length -
                  (treeNodeLimit[node.path] ?? chainPathTreeNodeLimit)
                ).toLocaleString()}{' '}
                remaining)...
              </Button>
            )}
          </>
        ) : null}
      </Stack>
    );
  };

  return <Stack gap={4}>{nodes.map((node) => renderNode(node))}</Stack>;
};
