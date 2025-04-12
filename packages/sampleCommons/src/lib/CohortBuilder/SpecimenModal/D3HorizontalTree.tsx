import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { graph } from './D3HorizontalTreeHelper.js'; // Ensure this function accepts a HierarchyNode<any> as its first argument

// Define the props interface
interface D3HorizontalTreeProps {
  root: d3.HierarchyNode<any>; // The root node of the tree (D3 hierarchy)
  label?: (d: d3.HierarchyNode<any>) => string; // Function to define node labels
  highlight?: (d: d3.HierarchyNode<any>) => boolean; // Function to highlight nodes
  marginLeft?: number; // Left margin for the tree
  dx?: number; // Vertical spacing between nodes
  dy?: number; // Horizontal spacing between nodes
  width?: number; // Width of the SVG
}

const D3HorizontalTreeComponent: React.FC<D3HorizontalTreeProps> = ({
  root,
  label = d => d.data.id, // Default label function
  highlight = () => false, // Default highlight function
  marginLeft = 40,
  dx = 12,
  dy = 120,
  width = 500,
}) => {
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (root) {
      // Clear previous SVG content
      d3.select(svgRef.current).selectAll('*').remove();

      // Render the D3 tree
      //TODO: figure out what's even going on here
      const svgNode = graph(root);
      if (svgNode instanceof Node) {
        svgRef.current?.appendChild(svgNode);
      } else {
        console.error('graph function did not return a valid Node.');
      }
    }
  }, [root, label, highlight, marginLeft, dx, dy, width]);

  return <div ref={svgRef}></div>;
};

export default D3HorizontalTreeComponent;