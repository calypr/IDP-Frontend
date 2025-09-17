import { useGeneralGQLQuery } from '@gen3/core';
import React from 'react';

import GraphTreeView from './GraphTreeView/GraphTreeView';
import DropdownTreeView from './DropdownTreeView/DropdownTreeView';
import { extractQueryContent } from '../ResearchSubjectModal/tools';
import { QueryContent, ResourceDict } from '../types';

export interface TreeNode {
  name: string;
  id: string;
  data: Record<string, any>;
  children?: TreeNode[];
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
    const specimenDicts = extractQueryContent(specimenFamilyData, 'specimen', '') as QueryContent;

    const specimenIdToLabel = specimenDicts.reduce((acc, specimen: ResourceDict) => {
      acc[specimen.id] = `${specimen.identifier} (${specimen.sample_type})`;
      return acc;
    }, {}) as Record<string, string>;

    // convert to edge list from parent to child
    const edges = specimenDicts.map((specimen: ResourceDict) => [specimen.parent, specimen.id]) as [string, string][];
    
    // handle load and error states
    if (familyIsLoading) {
      return <div>Loading Specimen Tree...</div>;
    }
    if (familyIsError) {
      return <div>Error loading Specimen Tree</div>;
    }
    
    // render tree depending on the view
    return graphView ?
    <GraphTreeView
      edges={edges}
      specimenIdToLabel={specimenIdToLabel}
      focusId={specimenId}
    /> :
    <DropdownTreeView
      specimenDicts={specimenDicts}
      edges={edges}
      specimenIdToLabel={specimenIdToLabel}
      focusId={specimenId}
    />;
}; 

export default SpecimenTree;