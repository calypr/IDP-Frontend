import React, { useMemo } from 'react';
import { ActionIcon, Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { StorageChainFinding } from './storageTypes';

const chainPathTreeNodeLimit = 250;
const expandVisibleRowBudget = 1000;

type ChainPathTreeNode = {
  readonly depth: number;
  isFolder: boolean;
  readonly label: string;
  readonly leafPath?: string;
  readonly path: string;
  readonly paths: Array<string>;
};

type ChainPathTreeProps = {
  readonly expandedTreeNodes: Record<string, boolean>;
  readonly findings: Array<StorageChainFinding>;
  readonly helperText?: string;
  readonly rootLimitKey: string;
  readonly selectedPaths: Array<string>;
  readonly treeNodeLimit: Record<string, number>;
  readonly onSelectedPathsChange: (paths: Array<string>) => void;
  readonly onTreeNodeLimitChange: (
    updater: (current: Record<string, number>) => Record<string, number>,
  ) => void;
  readonly onTreeNodeToggle: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
};

type ChainPathTreeNodeProps = Omit<
  ChainPathTreeProps,
  'findings' | 'rootLimitKey'
> & {
  readonly node: ChainPathTreeNode;
  readonly selectedPathsSet: Set<string>;
};

type VisibleFolder = {
  readonly childCount: number;
  readonly path: string;
};

const pathTreeSegments = (value: string): Array<string> => {
  const trimmed = value.trim();
  const urlMatch = /^([a-z][a-z0-9+.-]*:\/\/)([^/]+)\/?(.*)$/i.exec(trimmed);
  if (!urlMatch) {
    return trimmed.split('/').filter(Boolean);
  }

  return [
    urlMatch[1] + urlMatch[2],
    ...urlMatch[3].split('/').filter(Boolean),
  ];
};

const treeNodesAtDepth = (
  paths: Array<string>,
  depth: number,
): Array<ChainPathTreeNode> => {
  const nodes = new Map<string, ChainPathTreeNode>();

  paths.forEach((value) => {
    const segments = pathTreeSegments(value);
    if (segments.length <= depth) {
      return;
    }

    const path = segments.slice(0, depth + 1).join('/');
    const isFolder = segments.length > depth + 1;
    const existing = nodes.get(path);
    if (existing) {
      existing.paths.push(value);
      if (isFolder) {
        existing.isFolder = true;
      }
      return;
    }

    nodes.set(path, {
      depth,
      isFolder,
      label: segments[depth],
      leafPath: isFolder ? undefined : value,
      path,
      paths: [value],
    });
  });

  return Array.from(nodes.values()).sort((left, right) => {
    if (left.isFolder !== right.isFolder) {
      return left.isFolder ? -1 : 1;
    }
    return left.label.localeCompare(right.label, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
};

const updateSelectedPaths = ({
  checked,
  paths,
  selectedPaths,
}: {
  checked: boolean;
  paths: Array<string>;
  selectedPaths: Array<string>;
}): Array<string> => {
  if (checked) {
    return Array.from(new Set([...selectedPaths, ...paths])).sort();
  }
  const removed = new Set(paths);
  return selectedPaths.filter((path) => !removed.has(path));
};

const visibleCollapsedFolders = ({
  expandedTreeNodes,
  nodes,
  treeNodeLimit,
}: {
  expandedTreeNodes: Record<string, boolean>;
  nodes: Array<ChainPathTreeNode>;
  treeNodeLimit: Record<string, number>;
}): Array<VisibleFolder> => {
  const folders: Array<VisibleFolder> = [];
  const visit = (visibleNodes: Array<ChainPathTreeNode>): void => {
    visibleNodes.forEach((node) => {
      if (!node.isFolder) {
        return;
      }
      if (!expandedTreeNodes[node.path]) {
        const childCount = treeNodesAtDepth(node.paths, node.depth + 1).length;
        if (childCount > 0) {
          folders.push({ childCount, path: node.path });
        }
        return;
      }
      const children = treeNodesAtDepth(node.paths, node.depth + 1);
      const visibleLimit =
        treeNodeLimit[node.path] ?? chainPathTreeNodeLimit;
      visit(children.slice(0, visibleLimit));
    });
  };

  visit(nodes);
  return folders;
};

const ChainPathTreeNode = ({
  expandedTreeNodes,
  node,
  onSelectedPathsChange,
  onTreeNodeLimitChange,
  onTreeNodeToggle,
  selectedPaths,
  selectedPathsSet,
  treeNodeLimit,
}: ChainPathTreeNodeProps): JSX.Element => {
  const selectedCount = node.paths.filter((path) =>
    selectedPathsSet.has(path),
  ).length;
  const fullySelected =
    node.paths.length > 0 && selectedCount === node.paths.length;
  const partiallySelected =
    selectedCount > 0 && selectedCount < node.paths.length;
  const isExpanded = expandedTreeNodes[node.path] ?? false;
  const children = useMemo(
    () => (isExpanded ? treeNodesAtDepth(node.paths, node.depth + 1) : []),
    [isExpanded, node.depth, node.paths],
  );
  const visibleLimit = treeNodeLimit[node.path] ?? chainPathTreeNodeLimit;

  return (
    <Stack gap={4}>
      <Group gap="xs" style={{ paddingLeft: node.depth * 16 }}>
        {node.isFolder ? (
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
        ) : (
          <div style={{ width: 28 }} />
        )}
        <Checkbox
          checked={fullySelected}
          indeterminate={partiallySelected}
          label={node.label}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            if (!node.isFolder && node.leafPath) {
              onSelectedPathsChange(
                updateSelectedPaths({
                  checked,
                  paths: [node.leafPath],
                  selectedPaths,
                }),
              );
              return;
            }
            onSelectedPathsChange(
              updateSelectedPaths({
                checked,
                paths: node.paths,
                selectedPaths,
              }),
            );
          }}
        />
      </Group>
      {node.isFolder && isExpanded ? (
        <>
          {children
            .slice(0, visibleLimit)
            .map((child) => (
              <ChainPathTreeNode
                expandedTreeNodes={expandedTreeNodes}
                key={child.path}
                node={child}
                onSelectedPathsChange={onSelectedPathsChange}
                onTreeNodeLimitChange={onTreeNodeLimitChange}
                onTreeNodeToggle={onTreeNodeToggle}
                selectedPaths={selectedPaths}
                selectedPathsSet={selectedPathsSet}
                treeNodeLimit={treeNodeLimit}
              />
            ))}
          {children.length > visibleLimit ? (
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
                marginLeft: (node.depth + 1) * 16 + 28,
              }}
              variant="subtle"
            >
              Show more ({(children.length - visibleLimit).toLocaleString()}{' '}
              remaining)...
            </Button>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
};

export const ChainPathTree = ({
  expandedTreeNodes,
  findings,
  helperText,
  onSelectedPathsChange,
  onTreeNodeLimitChange,
  onTreeNodeToggle,
  rootLimitKey,
  selectedPaths,
  treeNodeLimit,
}: ChainPathTreeProps): JSX.Element => {
  const paths = useMemo(
    () =>
      Array.from(
        new Set(
          findings
            .map((finding) => finding.normalizedPath)
            .filter(Boolean),
        ),
      ).sort(),
    [findings],
  );
  const rootNodes = useMemo(() => treeNodesAtDepth(paths, 0), [paths]);
  const selectedPathsSet = useMemo(
    () => new Set(selectedPaths),
    [selectedPaths],
  );
  const visibleLimit = treeNodeLimit[rootLimitKey] ?? chainPathTreeNodeLimit;
  const selectedPathCount = paths.filter((path) => selectedPathsSet.has(path))
    .length;
  const expandVisible = (): void => {
    const folders = visibleCollapsedFolders({
      expandedTreeNodes,
      nodes: rootNodes.slice(0, visibleLimit),
      treeNodeLimit,
    });
    let renderedRows = 0;
    const pathsToExpand = folders.reduce<Array<string>>((selected, folder) => {
      const childLimit =
        treeNodeLimit[folder.path] ?? chainPathTreeNodeLimit;
      const nextRows = Math.min(folder.childCount, childLimit);
      if (renderedRows + nextRows > expandVisibleRowBudget) {
        return selected;
      }
      renderedRows += nextRows;
      selected.push(folder.path);
      return selected;
    }, []);
    if (pathsToExpand.length === 0) {
      return;
    }
    onTreeNodeToggle((current) => ({
      ...current,
      ...Object.fromEntries(pathsToExpand.map((path) => [path, true])),
    }));
  };

  return (
    <Stack
      className="rounded-md border border-slate-200 bg-white px-3 py-3"
      gap="xs"
    >
      <Group justify="space-between" wrap="wrap">
        <Checkbox
          checked={paths.length > 0 && selectedPathCount === paths.length}
          indeterminate={
            selectedPathCount > 0 && selectedPathCount < paths.length
          }
          label={`Select all loaded paths (${selectedPathCount.toLocaleString()} / ${paths.length.toLocaleString()})`}
          onChange={(event) =>
            onSelectedPathsChange(
              updateSelectedPaths({
                checked: event.currentTarget.checked,
                paths,
                selectedPaths,
              }),
            )
          }
        />
        <Group gap="xs" wrap="wrap">
          <Text c="dimmed" size="xs">
            {helperText ?? 'Expand folders and choose the exact paths to heal.'}
          </Text>
          <Button
            onClick={expandVisible}
            size="xs"
            title="Expands visible folders within a 1,000-row render budget. Click again to continue."
            variant="subtle"
          >
            Expand all visible
          </Button>
        </Group>
      </Group>
      <Stack gap={4}>
        {rootNodes.slice(0, visibleLimit).map((node) => (
          <ChainPathTreeNode
            expandedTreeNodes={expandedTreeNodes}
            key={node.path}
            node={node}
            onSelectedPathsChange={onSelectedPathsChange}
            onTreeNodeLimitChange={onTreeNodeLimitChange}
            onTreeNodeToggle={onTreeNodeToggle}
            selectedPaths={selectedPaths}
            selectedPathsSet={selectedPathsSet}
            treeNodeLimit={treeNodeLimit}
          />
        ))}
      </Stack>
      {rootNodes.length > visibleLimit ? (
        <Button
          onClick={() =>
            onTreeNodeLimitChange((current) => ({
              ...current,
              [rootLimitKey]:
                (current[rootLimitKey] ?? chainPathTreeNodeLimit) +
                chainPathTreeNodeLimit,
            }))
          }
          size="xs"
          style={{ alignSelf: 'flex-start', marginLeft: 28 }}
          variant="subtle"
        >
          Show more ({(rootNodes.length - visibleLimit).toLocaleString()}{' '}
          remaining)...
        </Button>
      ) : null}
    </Stack>
  );
};
