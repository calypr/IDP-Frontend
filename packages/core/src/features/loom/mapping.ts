import {
  ExplorerDataType,
  LoomDataType,
  LOOM_DATA_TYPES,
} from './types';

export const EXPLORER_TO_LOOM_DATA_TYPE: Readonly<
  Record<ExplorerDataType, LoomDataType>
> = {
  file: 'DocumentReference',
  document_reference: 'DocumentReference',
  research_subject: 'ResearchSubject',
  specimen: 'Specimen',
  medication_administration: 'MedicationAdministration',
  group_member: 'GroupMember',
};

export const isExplorerDataType = (
  value: string,
): value is ExplorerDataType => value in EXPLORER_TO_LOOM_DATA_TYPE;

export const isLoomDataType = (value: string): value is LoomDataType =>
  (LOOM_DATA_TYPES as ReadonlyArray<string>).includes(value);

export const toLoomDataType = (dataType: string): LoomDataType => {
  if (!isExplorerDataType(dataType)) {
    throw new Error(`Unsupported Explorer data type: ${dataType}`);
  }
  return EXPLORER_TO_LOOM_DATA_TYPE[dataType];
};
