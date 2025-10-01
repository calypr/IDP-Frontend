import { useGeneralGQLQuery } from '@gen3/core';
import {
  QueryContent,
  QueryHookResponse,
  QueryResponse,
  ResourceDict,
} from '../types';
import { useMemo } from 'react';

// TODO: prefer use of extractQueryContent over isQueryResponse and extractData (make these two private)
// create function to extract content from QueryResponse
export const extractQueryContent = (
  response: unknown,
  resourceType: string,
  aggregationVal: string,
) => {
  return isQueryResponse(response)
    ? (extractData(response, resourceType, aggregationVal) as QueryContent)
    : [];
};

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
   @param {string} aggregationVal If fetch response is an aggregation response, the index to index on
 * @returns {Record<string, any> || AggregationData}
 */
export function extractData(
  response: QueryResponse,
  index: string,
  aggregationVal: string,
) {
  if (aggregationVal !== '') {
    const aggregationData = response.data._aggregation[index]; // Access using string key
    if (aggregationData && aggregationVal in aggregationData) {
      const histogram = aggregationData[aggregationVal]?.histogram;
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
              group_member (filter: $filter, first: 10000) {
                group_member_group_id,
                group_member_member_id
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              group_member_member_id: member_ids,
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
export function useGroupToSpecimenMapping(
  specimen_ids: string[],
): QueryHookResponse {
  // get all group ids
  const {
    data: groupData,
    isLoading: groupIsLoading,
    isError: groupIsError,
  } = useFilteredGroupMembers(specimen_ids);

  // get specimen metadata
  const {
    data: specimenData,
    isLoading: specimenIsLoading,
    isError: specimenIsError,
  } = useGeneralGQLQuery({
    query: `query($filter: JSON) {
      specimen (filter: $filter, first: 10000) {
        specimen_id,
        specimen_sample_family_id,
        specimen_indexed_collection_date_days
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              specimen_id: specimen_ids,
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
      const memberData: QueryContent = isQueryResponse(groupData)
        ? extractData(groupData, 'group_member', '')
        : [];

      // get specimen data
      const specimenDicts: QueryContent = isQueryResponse(specimenData)
        ? extractData(specimenData, 'specimen', '')
        : [];

      // map specimens from specimen id to the rest of the metadata
      const specimenMap = specimenDicts.reduce((dict, specimen) => {
        dict[specimen.specimen_id] = { ...specimen };
        if (dict[specimen.specimen_id].specimen_id) {
          delete dict[specimen.specimen_id].specimen_id;
        }
        return dict;
      }, {});
      // const specimenMap = Object.fromEntries(specimenDicts.map(s => [s.id, {s}]));

      // map group to group members
      const groupMembers = memberData.reduce(
        (
          dict: Record<string, Array<ResourceDict>>,
          groupMember: ResourceDict,
        ) => {
          // fill in specimen data
          const memberWithSpecimen = {
            ...groupMember,
            ...specimenMap[groupMember.group_member_member_id],
          };

          // add to accumulator dict
          if (!dict[groupMember.group_member_group_id]) {
            dict[groupMember.group_member_group_id] = [memberWithSpecimen];
          } else {
            dict[groupMember.group_member_group_id].push(memberWithSpecimen);
          }

          return dict;
        },
        {},
      );

      return groupMembers;
    }

    return [];
  }, [groupData, specimenData]);

  // consolidate booleans
  const isLoading = groupIsLoading && specimenIsLoading;
  const isError = groupIsError && specimenIsError;

  return { data: groupToSpecimensMap, isLoading, isError };
}
