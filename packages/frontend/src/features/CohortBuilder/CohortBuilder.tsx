import React, { useEffect } from 'react';
import { useDeepCompareMemo, useDeepCompareEffect } from 'use-deep-compare';
import { CohortBuilderProps, CohortPanelConfiguration } from './types';
import { Tabs } from '@mantine/core';
import { CohortPanel } from './CohortPanel';
import { ProtectedContent } from '../../components/Protected';
import {
  selectCurrentCohortId,
  setSharedFilters,
  createNewCohort,
  useCoreDispatch,
  useCoreSelector,
} from '@gen3/core';
import CohortManager from './CohortManager/CohortManager';
import { TabsLayoutToComponentProp } from '../../utils/layout';

export const useGetCurrentCohort = () => {
  return useCoreSelector((state) => selectCurrentCohortId(state));
};

const CohortBuilder = ({
  explorerConfig,
  sharedFiltersMap = null,
  tabsLayout = 'left',
}: CohortBuilderProps) => {
  const dispatch = useCoreDispatch();

  useDeepCompareEffect(() => {
    dispatch(setSharedFilters(sharedFiltersMap ?? {}));
  }, [dispatch, sharedFiltersMap]);

  // Reset cohort when configuration changes (e.g. switching between different project explorers)
  // this prevents blank pages caused by using a cohort ID that doesn't exist in the new data context
  useDeepCompareEffect(() => {
    dispatch(createNewCohort({}));
  }, [dispatch, explorerConfig]);

  const configuration = useDeepCompareMemo(
    () => explorerConfig,
    [explorerConfig],
  );

  return (
    <ProtectedContent>
      <div className="flex flex-col w-full mt-2">
        <Tabs
          color="primary.4"
          variant={explorerConfig[0]?.tabType}
          keepMounted={true}
          defaultValue={explorerConfig[0].tabTitle}
        >
          <Tabs.List
            className="w-full"
            justify={TabsLayoutToComponentProp(tabsLayout)}
          >
            {configuration.map((panelConfig: CohortPanelConfiguration) => (
              <Tabs.Tab
                value={panelConfig.tabTitle}
                key={`${panelConfig.tabTitle}-tabList`}
                className="mt-2"
              >
                {panelConfig.tabTitle}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {configuration.map((panelConfig: CohortPanelConfiguration) => (
            <Tabs.Panel
              value={panelConfig.tabTitle}
              key={`${panelConfig.tabTitle}-${panelConfig.guppyConfig.dataType}-tabPanel`}
            >
              <CohortPanel
                guppyConfig={panelConfig.guppyConfig}
                key={`${panelConfig.tabTitle}-${panelConfig.guppyConfig.dataType}-CohortPanel`}
                chartsSection={panelConfig?.chartsSection}
                charts={panelConfig.charts}
                filters={panelConfig.filters}
                tabTitle={panelConfig.tabTitle}
                table={panelConfig.table}
                dropdowns={panelConfig.dropdowns}
                buttons={panelConfig.buttons}
                loginForDownload={panelConfig.loginForDownload}
                sharedFiltersMap={panelConfig.sharedFiltersMap}
              />
            </Tabs.Panel>
          ))}
        </Tabs>
      </div>
    </ProtectedContent>
  );
};

export default CohortBuilder;
