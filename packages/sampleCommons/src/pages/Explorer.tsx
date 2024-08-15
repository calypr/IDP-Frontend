import {
  ExplorerPage,
  ExplorerPageGetServerSideProps as getServerSideProps,
} from '@gen3/frontend';

import { registerCohortTableCustomCellRenderers } from '@/lib/CohortBuilder/CustomCellRenderers';
import { registerCustomExplorerDetailsPanels } from '@/lib/CohortBuilder/FileDetailsPanel';
import { registerCustomExplorerResourceDetailsPanels } from '@/lib/CohortBuilder/ResourceDetailsPanel';

registerCohortTableCustomCellRenderers();
registerCustomExplorerDetailsPanels();
registerCustomExplorerResourceDetailsPanels();

export default ExplorerPage;

export { getServerSideProps };
