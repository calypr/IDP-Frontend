import * as d3 from 'd3';
import { stratify, tree } from 'd3-hierarchy';
import React from 'react';
import SimpleNode from './SimpleNode';
import '@xyflow/react/dist/style.css';
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { TreeNode } from '../SpecimenTree';

const nodeTypes = {
    simpleNode: SimpleNode
  };

const GraphTreeView = ({
    edges,
    specimenIdToLabel,
    focusId,
  }: {
    edges: [string, string][];
    specimenIdToLabel: Record<string, string>;
    focusId: string;
  }) => {
    // build tree using labels into d3-hierarchy form 
    const d3Edges = edges.map((edge) => ({parentId: specimenIdToLabel[edge[0]], id: specimenIdToLabel[edge[1]]})) as Record<string,string>[];
  
    // create root, providing a data.label for each node
    const root = stratify()(d3Edges)
      .sort(
        (a, b) => b.height - a.height || d3.ascending(a.id, b.id)
      ) as d3.HierarchyNode<TreeNode>;
  
    const d3Tree = tree<TreeNode>()(root);
  
  
    // get all ancestors of the node with the same id as the focusLabel
    const focusLabel = specimenIdToLabel[focusId];
    const focusNode = d3Tree.descendants().find((node) => node.data.id === focusLabel);
    const focusAncestors: Set<string> = focusNode 
      ? new Set(focusNode.ancestors().map((ancestor) => ancestor.id) as string[])
      : new Set();
  
    // create nodes
    const reactFlowNodes = d3Tree.descendants().map((node) => {
      return {
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
  };
  
export default GraphTreeView;