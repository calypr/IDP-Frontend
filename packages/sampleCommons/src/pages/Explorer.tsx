import {
  ExplorerPage,
  ExplorerPageGetServerSideProps as getServerSideProps,
  registerCohortBuilderDefaultPreviewRenderers,
  registerExplorerDefaultCellRenderers,
} from '@gen3/frontend';

import { registerCohortTableCustomCellRenderers } from '@/lib/CohortBuilder/CustomCellRenderers';
import { registerCustomExplorerDetailsPanels } from '@/lib/CohortBuilder/FileDetailsPanel';
import { registerCustomExplorerResourceDetailsPanels } from '@/lib/CohortBuilder/ResourceDetailsPanel';
import { registerCustomExplorerMedicationAdministrationDetailsPanels } from '@/lib/CohortBuilder/MedicationAdministrationPanel';
import { registerCustomExplorerResearchSubjectDetailsPanels } from '@/lib/CohortBuilder/ResearchSubjectPanel';
import { registerCustomExplorerSpecimenDetailsPanels } from '@/lib/CohortBuilder/SpecimenDetailsPanel';

registerExplorerDefaultCellRenderers();
registerCohortBuilderDefaultPreviewRenderers();
registerCohortTableCustomCellRenderers();
registerCustomExplorerDetailsPanels();
registerCustomExplorerResourceDetailsPanels();
registerCustomExplorerMedicationAdministrationDetailsPanels();
registerCustomExplorerResearchSubjectDetailsPanels();
registerCustomExplorerSpecimenDetailsPanels();

export default ExplorerPage;

export { getServerSideProps };
