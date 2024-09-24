import {
  ExplorerPage,
  ExplorerPageGetServerSideProps as getServerSideProps,
} from '@gen3/frontend';

import { registerCohortTableCustomCellRenderers } from '@/lib/CohortBuilder/CustomCellRenderers';
import { registerCustomExplorerDetailsPanels } from '@/lib/CohortBuilder/FileDetailsPanel';
import { registerCustomExplorerResourceDetailsPanels } from '@/lib/CohortBuilder/ResourceDetailsPanel';
import { registerCustomExplorerResearchSubjectDetailsPanels } from '@/lib/CohortBuilder/ResearchSubjectPanel';

registerCohortTableCustomCellRenderers();
registerCustomExplorerDetailsPanels();
registerCustomExplorerResourceDetailsPanels();
registerCustomExplorerResearchSubjectDetailsPanels();

export default ExplorerPage;

export { getServerSideProps };
