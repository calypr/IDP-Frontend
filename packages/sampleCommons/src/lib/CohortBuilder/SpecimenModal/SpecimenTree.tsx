import { useGeneralGQLQuery } from "@gen3/core";
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, ControlledTreeEnvironment, TreeItem, TreeItemIndex } from 'react-complex-tree';
import "react-complex-tree/lib/style-modern.css";
import { extractData, isQueryResponse } from "../ResearchSubjectModal/tools";
import { QueryContent, ResourceDict } from "../types";
import { edgesToNestedTree, readTemplate, replaceIdsWithIdentifiers } from "./SpecimenTreeAlgo";
import { useState } from "react";

const SpecimenTree = ({
    sampleFamilyId, // The table value corresponding to the column name 'idField'
    specimenId,
  }: {
    sampleFamilyId: string;
    specimenId: string;
  }) => {
    // get all specimens in the same family
    const { data: specimenFamilyData, isLoading: familyIsLoading, isError: familyIsError } = useGeneralGQLQuery({
      query: `query ($filter: JSON) {
                specimen (filter: $filter,  accessibility: all, first: 10000) {
                  id
                  identifier
                  parent
                }
              }`,
      variables: {
        filter: {
          AND: [
            {
              IN: {
                  sample_family_id: [`${sampleFamilyId}`],
              }
            }
          ]
        },
      },
    });

    console.log("specimenFamilyData:", specimenFamilyData);

    // map specimen id to identifier
    const specimenDicts = isQueryResponse(specimenFamilyData)
      ? (extractData(specimenFamilyData, 'specimen', '') as QueryContent)
      : [];

    const idToIdentifierMap = specimenDicts.reduce((acc, specimen: ResourceDict) => {
      acc[specimen.id] = specimen.identifier;
      return acc;
    }, {} as Record<string, string>);

    // convert to edge list from parent to child
    const edges = specimenDicts.map((specimen: ResourceDict) => [specimen.parent, specimen.id]);
    console.log("edges:", edges);

    const nestedTree = edgesToNestedTree(edges);

    // format tree with identifiers
    console.log("EHEJHE:",)
    const identifierTree = replaceIdsWithIdentifiers(idToIdentifierMap, nestedTree);
    const treeWithRoot = {
      root: identifierTree
      // root: {
        // [sampleFamilyId]: Object.keys(identifierTree).length == 0
        //   ? null
        //   : identifierTree
      // }
    };
    console.log("treeWithRoot:", treeWithRoot);
    const formattedTree = readTemplate(treeWithRoot);
    console.log("tree:", formattedTree);

    // const identifierTree = replaceIdsWithIdentifiers(idToIdentifierMap, nestedTree);
    // const formattedTree = readTemplate(identifierTree, specimenId);
    // console.log("tree:", formattedTree);

    // // add sample family ID as visible root
    // const treeWithRoot = {
    //   [sampleFamilyId]: {
    //     index: sampleFamilyId,
    //     isFolder: true,
    //     children: formattedTree?.root?.children,
    //     data: sampleFamilyId,
    //   },
    //   root: {
    //     children: [sampleFamilyId],
    //     ...formattedTree.root
    //   },
    //   ...formattedTree.items
    // };
    const focus = idToIdentifierMap[specimenId];
    const dataProvider = new StaticTreeDataProvider(formattedTree.items, (item, data) => ({ ...item, data }));

    const [expandedItems, setExpandedItems] = useState([] as TreeItemIndex[]);

    
    // convert tree into 
    return !familyIsLoading ? (
    <UncontrolledTreeEnvironment
      dataProvider={dataProvider}
      getItemTitle={item => item.data}
      viewState={{
        ['specimen-tree']: {
          expandedItems
        }
      }}
      renderItemTitle={({ title }) => title !== focus ? title : <strong>{title}</strong>}
    >
      <Tree treeId="specimen-tree" rootItem="root" treeLabel="Tree Example" />
    </UncontrolledTreeEnvironment>)
    : <div>Loading...</div>;
}; 

export default SpecimenTree;