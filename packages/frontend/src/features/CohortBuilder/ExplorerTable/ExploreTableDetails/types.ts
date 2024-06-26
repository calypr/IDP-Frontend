import { DetailsPanelComponentProps } from '../../../../components/Details/types';
import { SummaryTable } from '../types';

export interface TableDetailsPanelProps extends DetailsPanelComponentProps {
  index: string;
  tableConfig: SummaryTable;
}

/**
 * Represents the configuration for the Explorer details.
 *
 * @interface ExplorerDetailsConfig
 * @property {('click' | 'doubleclick' | 'expand')} [mode] - The interaction mode for the Explorer details. Default is 'click'.
 * @property {string} [title] - The title of the Explorer details.
 * @property {string} panel - The panel name for the Explorer details that has been registered with the appropriate factory
 * @property {Record<string, unknown>} [params] - Additional parameters for the Explorer details panel.
 * @property {Record<string, string>} [classNames] - Additional CSS class names for the Explorer modal | drawer.
 * @property {string} [idField] - The field used as an identifier for the Explorer details.
 * @property {string} [nodeType] - The node type used to index on
   @property {string[]} [nodeFields] - The fields to query the node type on
   @property {string} [filterField] The field that is filtered on when selecting a specific Row ID
 */
export interface ExplorerDetailsConfig {
  mode?: 'click' | 'doubleclick' | 'expand';
  title?: string;
  panel: string;
  params?: Record<string, unknown>;
  classNames?: Record<string, string>;
  idField?: string;
  nodeType?: string;
  nodeFields?: string[];
  filterField?: string;
}
