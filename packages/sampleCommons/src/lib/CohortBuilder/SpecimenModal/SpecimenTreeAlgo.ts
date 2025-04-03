// Main function to convert edges to nested tree
export const edgesToNestedTree = (edges: Array<Array<string>>) => {
  // Build the children map
  const tree = buildChildrenMap(edges);
  
  // Find root nodes
  const rootNodes = findRootNodes(tree);
  
  // Build the nested tree starting from root nodes
  const nestedTree = {} as Record<string,any>;
  for (const root of rootNodes) {
    // handle specimens with no children
    if (root in tree && tree[root].length == 0){
      nestedTree[root] = null;
      continue;
    }
    Object.assign(nestedTree, buildNestedTree(root, tree));
  }
  
  return nestedTree;
};

// Step 1: Build the initial dictionary of children
const buildChildrenMap = (edges: Array<Array<string>>): Record<string,any> => {
  const tree = {} as Record<string,any>;
  for (const [parent, child] of edges) {

      // initialize specimen with no parent if it's not already in the tree
      // otherwise nothing needs to be added
      if (!parent){
        if (!(child in tree)){
          tree[child] = [];
        }
        continue;
      }
      
      // add parent if they're not in the tree
      if (!(parent in tree)) {
        tree[parent] = [];
      }
      tree[parent].push(child);
  }
  
  return tree;
};

// Step 2: Recursively build the nested structure
const buildNestedTree = (node: string, tree: Record<string,any>) => {
  // If the node has children, recursively nest them
  if (node in tree) {
    const children = tree[node];
    const nestedChildren = {};
    
    for (const child of children) {
        Object.assign(nestedChildren, buildNestedTree(child, tree));
    }
    
    // Return the nested structure
    return { [node]: nestedChildren };
  } else {
    // Return a leaf node (no children)
    return { [node]: null };
  }
};

// Step 3: Find the root nodes (nodes that are not a child of any other node)
const findRootNodes = (tree: Record<string,any>) => {
  const allNodes = new Set(Object.keys(tree));
  
  const childNodes = new Set(
    Array.from(Object.values(tree)).flat()
  );
  
  return new Set(
  [...allNodes].filter(node => !(childNodes.has(node)))
  );
};