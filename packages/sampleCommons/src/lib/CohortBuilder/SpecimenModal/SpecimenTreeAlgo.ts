// Main function to convert edges to nested tree
// Build the children map
export const edgesToNestedTree = (edges: Array<Array<string>>) => {
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

export const replaceIdsWithIdentifiers = (idMap: Record<string,string>, nestedDict: Record<string,any>): Record<string,any> => {
  if (Array.isArray(nestedDict)) {
    return nestedDict.map(item => replaceIdsWithIdentifiers(idMap, item));
  }

  if (typeof nestedDict === 'object' && nestedDict !== null) {
    return Object.fromEntries(
      Object.entries(nestedDict).map(([key, value]) => [
        idMap[key] ?? key, // use nullish coalescing to avoid falsy values like 0
        replaceIdsWithIdentifiers(idMap, value)
      ])
    );
  }

  return nestedDict; // base case: primitive value
};

// read a nested tree of format {a: {b: {c: null}}, d} and convert it to react complex tree format
export const readTemplate = (template: Record<string, any>, data: Record<string, any> = { items: {} }) => {
  for (const [key, value] of Object.entries(template)) {
    data.items[key] = {
      index: key,
      canMove: true,
      isFolder: value !== null,
      children: value !== null ? Object.keys(value as object) : undefined,
      data: key,
      canRename: true
    };

    if (value !== null) {
      readTemplate(value, data);
    }
  }

  return data;
};