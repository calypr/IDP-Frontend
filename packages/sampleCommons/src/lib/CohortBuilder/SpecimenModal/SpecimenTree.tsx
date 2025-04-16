import { useGeneralGQLQuery } from '@gen3/core';
import { StaticTreeDataProvider, Tree as ReactComplexTree, UncontrolledTreeEnvironment } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { extractData, isQueryResponse } from '../ResearchSubjectModal/tools';
import { QueryContent, ResourceDict } from '../types';
import { edgesToNestedTree } from './SpecimenTreeAlgo';
import { readTemplate, replaceIdsWithLabels, sortJsonKeys } from './SpecimenTreeHelpers';

import React from 'react';
import '@xyflow/react/dist/style.css';
import { stratify, tree } from 'd3-hierarchy';
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import * as d3 from 'd3';
import SimpleNode from './SimpleNode';

interface TreeNode {
  name: string;
  id: string;
  data: Record<string,any>;
  children?: TreeNode[];
}

const nodeTypes = {
  simpleNode: SimpleNode
};

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
    const dataProvider = new StaticTreeDataProvider(formattedTree.items, (item, data) => ({ ...item, data }));

    // get parent ids to highlight for 
    const focusId = specimenId;
    const focusLabel = specimenIdToLabel[focusId];
    const childEdgeMap = specimenDicts.reduce((acc, specimen: ResourceDict) => {
      acc[specimen.id] = specimen.parent;
      return acc;
    }, {}) as Record<string, string>;
    const specimenParentIds = [focusId];
    let specimen = focusId;
    while(specimen in childEdgeMap && childEdgeMap[specimen]) {
      specimen = childEdgeMap[specimen];
      specimenParentIds.push(specimen);
    }
    const specimenParentLabels = specimenParentIds.map((id) => specimenIdToLabel[id]);
    
    // handle load and error states
    if (familyIsLoading) {
      return <div>Loading Specimen Tree...</div>;
    }
    if (familyIsError) {
      return <div>Error loading Specimen Tree</div>;
    }

    // show graph view
    if (graphView && !familyIsLoading) {
      // build tree using labels into d3-hierarchy form 
      const d3Edges = edges.map((edge) => ({parentId: specimenIdToLabel[edge[0]], id: specimenIdToLabel[edge[1]]})) as Record<string,string>[];

      // create root, providing a data.label for each node
      const root = stratify()(d3Edges)
        .sort(
          (a, b) => b.height - a.height || d3.ascending(a.id, b.id)
        ) as d3.HierarchyNode<TreeNode>;
      
      const d3Tree = tree<TreeNode>()(root);
      

      // get all ancestors of the node with the same id as the focusId
      const focusNode = d3Tree.descendants().find((node) => node.data.id === focusLabel);
      const focusAncestors: Set<string> = focusNode 
        ? new Set(focusNode.ancestors().map((ancestor) => ancestor.id) as string[])
        : new Set();

      // create nodes
      const reactFlowNodes = d3Tree.descendants().map((node) => {
        const val = {
          id: node.data.id,
          type: 'simpleNode',
          data: {
            ...node.data,
            label: node.id,
            isAncestor: node.id && focusAncestors.has(node.id),
          },
          // font bolded if the node is an ancestor of the focus node
          style: {
            fontWeight: node.id && focusAncestors.has(node.id) ? 'bold' : 'normal',
          },
          position: {x: node.y * 1400, y: node.x * 1400 } // horizontal tree
        };
        return val;
      });

      // create edges with conditional styles
      const ancestorEdgeStyle = {
        stroke: 'black',
        strokeWidth: 2
      };

      const reactFlowEdges = d3Edges.map((edge) => (
        {
          id: `${edge.parentId}-${edge.id}`,
          data: {
            betweenAncestors: focusAncestors.has(edge.parentId) && focusAncestors.has(edge.id),
          },
          // make the line thicker if the edge is between two ancestors of the focus node
          style: focusAncestors.has(edge.parentId) && focusAncestors.has(edge.id)  
            ? ancestorEdgeStyle
            : {},
          target: edge.parentId,
          source: edge.id
        }
      ));

      console.log('reactFlowNodes:', reactFlowNodes);
      console.log('reactFlowEdges:', reactFlowEdges);
      
      return (
        <div style={{
          width: '100%',
          height: 800
        }}
        >
          <ReactFlowProvider>
            <ReactFlow
              nodes={reactFlowNodes}
              edges={reactFlowEdges}
              nodeTypes={nodeTypes}
              zoomOnScroll={false}
              preventScrolling={false}
              fitView
            >
              <Controls showZoom={true} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      );
    }
    
    // render tree using react complex tree
    return (
      <UncontrolledTreeEnvironment
        dataProvider={dataProvider}
        getItemTitle={item => item.data}
        viewState={{}}
        renderItemTitle={({title}) => (
          specimenParentLabels.includes(title)
            ? title == focusLabel 
              ? (<strong>{title} *</strong>)
              : (<strong>{title}</strong>)
            : title
          )
        }
        onFocusItem={() => {}}
      >
        <ReactComplexTree
          treeId="specimen-tree"
          rootItem="root"
          treeLabel="Specimen Tree"
        />
      </UncontrolledTreeEnvironment>
    );
}; 

export default SpecimenTree;