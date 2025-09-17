import React from 'react';
import { ResourceDict } from '../../types';
import { edgesToNestedTree } from './DropdownTreeAlgo';
import {
  readTemplate,
  replaceIdsWithLabels,
  sortJsonKeys,
} from './DropdownTreeHelpers';

import {
  StaticTreeDataProvider,
  Tree as ReactComplexTree,
  UncontrolledTreeEnvironment,
} from 'react-complex-tree';
//import 'react-complex-tree/lib/style-modern.css';

const DropdownTreeView = ({
  specimenDicts,
  edges,
  specimenIdToLabel,
  focusId,
}: {
  specimenDicts: ResourceDict[];
  edges: [string, string][];
  specimenIdToLabel: Record<string, string>;
  focusId: string;
}) => {
  // check if there are any edges or labels
  if (edges.length === 0 || Object.keys(specimenIdToLabel).length === 0) {
    return <div>No specimen tree available</div>;
  }

  const nestedTree = edgesToNestedTree(edges);

  // format tree with identifiers
  const labeledTree = replaceIdsWithLabels(specimenIdToLabel, nestedTree);
  const keySortedTree = sortJsonKeys(labeledTree);
  const treeWithRoot = {
    root: keySortedTree,
  };

  const formattedTree = readTemplate(treeWithRoot);
  const dataProvider = new StaticTreeDataProvider(
    formattedTree.items,
    (item, data) => ({ ...item, data }),
  );

  // get parent ids to highlight the path to the focus node
  const childEdgeMap = specimenDicts.reduce((acc, specimen: ResourceDict) => {
    acc[specimen.id] = specimen.parent;
    return acc;
  }, {}) as Record<string, string>;

  const specimenParentIds = [focusId];
  let specimen = focusId;
  while (specimen in childEdgeMap && childEdgeMap[specimen]) {
    specimen = childEdgeMap[specimen];
    specimenParentIds.push(specimen);
  }
  const specimenParentLabels = specimenParentIds.map(
    (id) => specimenIdToLabel[id],
  );
  const focusLabel = specimenIdToLabel[focusId];

  return (
    <UncontrolledTreeEnvironment
      dataProvider={dataProvider}
      getItemTitle={(item) => item.data}
      viewState={{}}
      renderItemTitle={({ title }) =>
        specimenParentLabels.includes(title) ? (
          title == focusLabel ? (
            <strong>{title} *</strong>
          ) : (
            <strong>{title}</strong>
          )
        ) : (
          title
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

export default DropdownTreeView;
