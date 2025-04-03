import { useGeneralGQLQuery } from '@gen3/core';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { extractData, isQueryResponse } from '../ResearchSubjectModal/tools';
import { QueryContent, ResourceDict } from '../types';
import { edgesToNestedTree } from './SpecimenTreeAlgo';
import { readTemplate, replaceIdsWithLabels, sortJsonKeys } from './SpecimenTreeHelpers';

import React from 'react';
import '@xyflow/react/dist/style.css';
import { hierarchy, stratify, tree } from 'd3-hierarchy';
import { Tree as D3Tree, TreeNodeDatum } from 'react-d3-tree';

interface TreeNode {
  name: string;
  id: string;
  children?: TreeNode[];
}

function buildTree(edgeList: [string, string][]): TreeNode {
  const nodeMap: Map<string, TreeNode> = new Map();

  // Create nodes for each unique name
  for (const [parent, child] of edgeList) {
    if (!nodeMap.has(parent)) {
      nodeMap.set(parent, { name: parent });
    }
    if (!nodeMap.has(child)) {
      nodeMap.set(child, { name: child });
    }
  }

  // Assign children to parent nodes
  for (const [parent, child] of edgeList) {
    const parentNode = nodeMap.get(parent);
    const childNode = nodeMap.get(child);

    if (parentNode && childNode) {
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(childNode);
    }
  }

  // Assuming the first element in the edge list is the root
  const rootName = edgeList[0][0];
  return nodeMap.get(rootName)!;
}

function replaceNamesWithLabels(
  tree: TreeNode,
  labelMap: { [key: string]: string }
): TreeNode {
  function traverse(node: TreeNode): void {
    if (labelMap[node.id]) {
      node.name = labelMap[node.id];
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(tree);
  return tree;
}

const SpecimenTree = ({
    projectId, // required in case the same sample family ids is used across projects
    sampleFamilyId, // The table value corresponding to the column name 'idField'
    specimenId,
    sampleTypeField, //field name for sample type
    graphView = false
  }: {
    projectId: string;
    sampleFamilyId: string;
    specimenId: string;
    sampleTypeField: string;
    graphView: boolean;
  }) => {
    // get all specimens in the same family
    const { data: specimenFamilyData, isLoading: familyIsLoading, isError: familyIsError } = useGeneralGQLQuery({
      query: `query ($filter: JSON) {
                specimen (filter: $filter,  accessibility: all, first: 10000) {
                  id
                  identifier
                  ${sampleTypeField}
                  parent
                }
              }`,
      variables: {
        filter: {
          AND: [
            {
              EQ: {
                project_id: `${projectId}`,
              }
            },
            {
              EQ: {
                sample_family_id: `${sampleFamilyId}`,
              }
            }
          ]
        },
      },
    });

    // map specimen id to identifier
    const specimenDicts = isQueryResponse(specimenFamilyData)
      ? (extractData(specimenFamilyData, 'specimen', '') as QueryContent)
      : [];

    const specimenIdToLabel = specimenDicts.reduce((acc, specimen: ResourceDict) => {
      acc[specimen.id] = `${specimen.identifier} (${specimen.sample_type})`;
      return acc;
    }, {}) as Record<string, string>;

    // convert to edge list from parent to child
    const edges = specimenDicts.map((specimen: ResourceDict) => [specimen.parent, specimen.id]) as [string, string][];

    const nestedTree = edgesToNestedTree(edges);

    // format tree with identifiers
    const labeledTree = replaceIdsWithLabels(specimenIdToLabel, nestedTree);
    const keySortedTree = sortJsonKeys(labeledTree);
    const treeWithRoot = {
      root: keySortedTree
    };

    const formattedTree = readTemplate(treeWithRoot);

    const focus = specimenIdToLabel[specimenId];
    const dataProvider = new StaticTreeDataProvider(formattedTree.items, (item, data) => ({ ...item, data }));
    
    // handle load and error states
    if (familyIsLoading) {
      return <div>Loading Specimen Tree...</div>;
    }
    if (familyIsError) {
      return <div>Error loading Specimen Tree</div>;
    }

    // show graph view
    if (graphView && !familyIsLoading) {
      // build tree into d3-hierarchy form 
      // const edgesAsLabels = edges.map((edge) => edge.map((id) => specimenIdToLabel[id]));
      // const d3Tree = buildTree(edges);
      const d3Edges = edges.map((edge) => ({parent: edge[0], child: edge[1]}));
      const d3Tree = stratify()
        .id((d) => d.child)
        .parentId((d) => d.parent)
        (d3Edges);

      // Convert d3 tree nodes
      replaceNamesWithLabels(d3Tree, specimenIdToLabel);
      

      return (
        // graph(d3Tree)
        <div style={{
          width: '100%',
          height: '100%'
        }}>
          <D3Tree
            data={d3Tree}
            orientation="vertical"
            translate={{ x: 400, y: 50 }}
            pathFunc="diagonal"
            separation={{ siblings: 2, nonSiblings: 3 }}
          />
        </div>
      );
    }
    
    // render tree using react complex tree
    return (
      <UncontrolledTreeEnvironment
        dataProvider={dataProvider}
        getItemTitle={item => item.data}
        viewState={{
          ['specimen-tree']: {
            expandedItems: [sampleFamilyId],
        }}}
        renderItemTitle={({title}) => title !== focus ? title : (<strong>{title}</strong>)}
        onFocusItem={() => {}}
      >
        <Tree treeId="specimen-tree" rootItem="root" treeLabel="Specimen Tree" />
      </UncontrolledTreeEnvironment>);
}; 

export default SpecimenTree;