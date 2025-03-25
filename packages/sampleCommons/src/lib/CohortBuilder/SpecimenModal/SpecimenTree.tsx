import { useGeneralGQLQuery } from '@gen3/core';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { extractData, isQueryResponse } from '../ResearchSubjectModal/tools';
import { QueryContent, ResourceDict } from '../types';
import { edgesToNestedTree, readTemplate, replaceIdsWithIdentifiers } from './SpecimenTreeAlgo';

const SpecimenTree = ({
    projectId, // required in case the same sample family ids is used across projects
    sampleFamilyId, // The table value corresponding to the column name 'idField'
    specimenId,
  }: {
    projectId: string;
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

    const idToIdentifierMap = specimenDicts.reduce((acc, specimen: ResourceDict) => {
      acc[specimen.id] = specimen.identifier;
      return acc;
    }, {} as Record<string, string>);

    // convert to edge list from parent to child
    const edges = specimenDicts.map((specimen: ResourceDict) => [specimen.parent, specimen.id]);

    const nestedTree = edgesToNestedTree(edges);

    // format tree with identifiers
    const identifierTree = replaceIdsWithIdentifiers(idToIdentifierMap, nestedTree);
    const treeWithRoot = {
      root: identifierTree
    };

    const formattedTree = readTemplate(treeWithRoot);

    const focus = idToIdentifierMap[specimenId];
    const dataProvider = new StaticTreeDataProvider(formattedTree.items, (item, data) => ({ ...item, data }));
    
    // render tree using react complex tree
    return !familyIsLoading ? (
    <UncontrolledTreeEnvironment
      dataProvider={dataProvider}
      getItemTitle={item => item.data}
      viewState={{
        ['specimen-tree']: {
          expandedItems: [sampleFamilyId],
      }}}
      renderItemTitle={({title}) => title !== focus ? title : (<strong>{title}</strong>)}
    >
      <Tree treeId="specimen-tree" rootItem="root" treeLabel="Tree Example" />
    </UncontrolledTreeEnvironment>)
    : <div>Loading Specimen Tree...</div>;
}; 

export default SpecimenTree;