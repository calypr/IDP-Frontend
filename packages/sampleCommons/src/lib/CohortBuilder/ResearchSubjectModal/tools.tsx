import { useGeneralGQLQuery } from '@gen3/core';
import { QueryContent, QueryHookResponse, QueryResponse, ResourceDict } from '../types';
import { useMemo } from 'react';

// TODO: we should try and consolidate the definitions of this at some point
/**
 * Checks if the given object is a QueryResponse.
 *
 * @param {any} obj - The object to be checked.
 * @returns {boolean} Returns true if the object is a QueryResponse, false otherwise.
 */
export const isQueryResponse = (obj: any): obj is QueryResponse => {
  // Considering that the data property can be optional
  return (
    typeof obj === 'object' &&
    (obj.data === undefined || typeof obj.data === 'object')
  );
};

/**
 * Checks if QueryResponse is populated then indexes to the inner list
 *
 * @param {QueryResponse} response The fetch response object to be indexed
   @param {string} index The name to index on
   @param {string} aggregation_val If fetch response is an aggregation response, the index to index on
 * @returns {Record<string, any> || AggregationData}
 */
export function extractData(
  response: QueryResponse,
  index: string,
  aggregation_val: string,
) {
  if (aggregation_val !== '') {
    const aggregationData = response.data._aggregation[index]; // Access using string key
    if (aggregationData && aggregation_val in aggregationData) {
      const histogram = aggregationData[aggregation_val]?.histogram;
      return Array.isArray(histogram) && histogram.length > 0 ? histogram : [];
    }
  }
  return Array.isArray(response.data[index]) && response.data[index].length > 0
    ? response.data[index]
    : [];
}

export const useFilteredGroupMembers = (member_ids: Array<string>) => {
  return useGeneralGQLQuery({
    query: `query($filter: JSON) {
              groupmember (filter: $filter, first: 10000) {
                group_id,
                member_id
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              member_id: member_ids,
            },
          },
        ],
      },
    },
  });
};

/**
 * given specimen IDs, get mapping of Group IDs to Specimen metadata (array of Specimen dicts)
 *
 * @export
 * @param {string[]} specimen_ids
 * @returns {QueryHookResponse}
 */
export function useGroupToSpecimenMapping(specimen_ids: string[]) : QueryHookResponse {
  // get all group ids 
  const { data: groupData, isLoading: groupIsLoading, isError: groupIsError } = useFilteredGroupMembers(specimen_ids);

  // get specimen metadata 
  const { data: specimenData, isLoading: specimenIsLoading, isError: specimenIsError } = useGeneralGQLQuery({
    query: `query($filter: JSON) {
      specimen (filter: $filter, first: 10000) {
        id,
        sample_family_id,
        indexed_collection_date_days
      }
    }`,
    variables: {
    filter: {
    AND: [
      {
        IN: {
          id: specimen_ids,
        },
      },
    ],
    },
    },
  });

  // get mapping from group ID to member specimen dicts
  const groupToSpecimensMap = useMemo(() => {
    if (groupData && specimenData) {
      // get group member data
      const memberData : QueryContent = isQueryResponse(groupData)
      ? extractData(groupData, 'groupmember', '')
      : [];

      // get specimen data
      const specimenDicts : QueryContent = isQueryResponse(specimenData)
      ? extractData(specimenData, 'specimen', '')
      : []; 

      // map specimens from specimen id to the rest of the metadata
      const specimenMap = specimenDicts.reduce(
        (dict, specimen) => {
          dict[specimen.id] = {...specimen};
          if (dict[specimen.id].id){
            delete dict[specimen.id].id;
          }
          return dict;
        },
        {}
      );
      // const specimenMap = Object.fromEntries(specimenDicts.map(s => [s.id, {s}]));

      // map group to group members
      const groupMembers = memberData.reduce((dict: Record<string, Array<ResourceDict>>, groupMember: ResourceDict) => {
        // fill in specimen data
        const memberWithSpecimen = {
          ...groupMember,
          ...specimenMap[groupMember.member_id]
        };

        // add to accumulator dict
        if (!dict[groupMember.group_id]){
          dict[groupMember.group_id] = [memberWithSpecimen];
        }
        else {
          dict[groupMember.group_id].push(memberWithSpecimen);
        }

        return dict;
      }, {});

      return groupMembers;
    }

    return [];
  }, [groupData, specimenData]);

  // consolidate booleans
  const isLoading = groupIsLoading && specimenIsLoading;
  const isError = groupIsError && specimenIsError;

  return {data: groupToSpecimensMap, isLoading, isError};
}