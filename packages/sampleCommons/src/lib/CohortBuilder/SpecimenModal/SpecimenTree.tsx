import { useGeneralGQLQuery } from '@gen3/core';
import { StaticTreeDataProvider, Tree as ReactComplexTree, UncontrolledTreeEnvironment } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { extractData, isQueryResponse } from '../ResearchSubjectModal/tools';
import { QueryContent, ResourceDict } from '../types';
import { edgesToNestedTree } from './SpecimenTreeAlgo';
import { readTemplate, replaceIdsWithLabels, sortJsonKeys } from './SpecimenTreeHelpers';

import React, { useCallback, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { HierarchyNode, stratify, tree } from 'd3-hierarchy';
import { graph } from './D3HorizontalTreeHelper.js';
import D3HorizontalTreeComponent from './D3HorizontalTree';
import { Tree as ReactD3Tree, TreeNodeDatum } from 'react-d3-tree';
import {
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import * as d3 from 'd3';
import SimpleNode from './SimpleNode';

interface TreeNode {
  name: string;
  id: string;
  children?: TreeNode[];
}

function replaceNamesWithLabels(
  tree: HierarchyNode<TreeNode>,
  labelMap: { [key: string]: string }
): HierarchyNode<TreeNode> {
  function traverse(node: HierarchyNode<TreeNode>): void {
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

const g = tree();
 
const getLayoutedElements = (nodes, edges, options) => {
  if (nodes.length === 0) return { nodes, edges };
 
  const { width, height } = document
    .querySelector(`[data-id="${nodes[0].id}"]`)
    .getBoundingClientRect();
  const hierarchy = stratify()
    .id((node) => node.id)
    .parentId((node) => edges.find((edge) => edge.target === node.id)?.source);
  const root = hierarchy(nodes);
  const layout = g.nodeSize([width * 2, height * 2])(root);
 
  return {
    nodes: layout
      .descendants()
      .map((node) => ({ ...node.data, position: { x: node.x, y: node.y } })),
    edges,
  };
};
 
const LayoutFlow = () => {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
 
  const onLayout = useCallback(
    (direction) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        {
          direction,
        },
      );
 
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
 
      fitView();
    },
    [nodes, edges],
  );
 
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
    >
      <Panel position="top-right">
        <button onClick={onLayout}>layout</button>
      </Panel>
    </ReactFlow>
  );
};

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
      // build tree into d3-hierarchy form 
      const d3Edges = edges.map((edge) => ({parentId: edge[0], id: edge[1]})) as Record<string,string>[];
      
      // const d3Tree = tree().nodeSize([dx, dy])(stratify<TreeNode>()(d3Edges));
      const root = stratify<TreeNode>()(d3Edges);
      const dx = 10;
      const padding = 1;
      const dy = 800 / (root.height + padding);
      root.sort((a, b) => d3.ascending(a.data.name, b.data.name));
      const d3Tree = tree().nodeSize([dx, dy])(root);
      console.log("d3Tree.descendants():", d3Tree.descendants());

      console.log("d3Tree:", d3Tree); 
      console.log("new tree:", tree()(d3Tree)); 

      // get nodes using specimenDict


      // Convert d3 tree nodes
      replaceNamesWithLabels(d3Tree, specimenIdToLabel);

      // create nodes
      const reactFlowNodes = d3Tree.descendants().map((node, index) => {
        console.log("node:", node);
        return {
          id: node.data.id,
          type: 'simpleNode',
          data: { label: specimenIdToLabel[node.data.id] },
          position: {x: node.y * 1400, y: node.x * 1400 },
        };
      });

      // create edges
      const reactFlowEdges = edges.map((edge) => ({id: `${edge[0]}-${edge[1]}`, target: edge[0], source: edge[1]}));
      
      // check that everything looks good
      console.log("reactFlowNodes:", reactFlowNodes);
      console.log("reactFlowEdges:", reactFlowEdges);

      // const [stateNodes, setNodes] = useState(reactFlowNodes);
      // const [stateEdges, setEdges] = useState(reactFlowEdges);

      // const onNodesChange = useCallback(
      //   (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
      //   [setNodes],
      // );
      // const onEdgesChange = useCallback(
      //   (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
      //   [setEdges],
      // );
 
      
      return (
        // graph(d3Tree)
        <div style={{
          width: '100%',
          height: 800
        }}
          // className="text-sm"
        >
          {/* <D3HorizontalTreeComponent
            root={d3Tree}
            label={d => d.data.id}
            highlight={d => d.data.id === 'Child 1'}
            marginLeft={40}
            dx={12}
            dy={120}
            width={500}
          /> */}
          {/* <D3Tree
            data={d3Tree}
            orientation="horizontal"
            translate={{ x: 400, y: 50 }}
            pathFunc="diagonal"
            separation={{ siblings: 0.4, nonSiblings: 0.6 }}
            rootNodeClassName="radius-xl"
          /> */}

          <ReactFlowProvider>
            <ReactFlow
              nodes={reactFlowNodes}
              edges={reactFlowEdges}
              nodeTypes={nodeTypes}
              // nodes={stateNodes}
              // edges={stateEdges}
              // onNodesChange={onNodesChange}
              // onEdgesChange={onEdgesChange}
              fitView
            />
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