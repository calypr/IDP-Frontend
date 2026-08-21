import React from 'react';
import { useDeepCompareEffect } from 'use-deep-compare';
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
import { cohortBuilderPanelsFromRuntime } from './explorerRuntime';
import { TabsLayoutToComponentProp } from '../../utils/layout';

export const useGetCurrentCohort = () => {
  return useCoreSelector((state) => selectCurrentCohortId(state));
};

const CohortBuilder = ({
  runtime,
  project,
  activeTab,
  hideTabList = false,
  onTabChange,
  sharedFiltersMap = null,
}: CohortBuilderProps) => {
  const runtimeProjection = cohortBuilderPanelsFromRuntime(runtime, project);
  const configuration = runtimeProjection.panels;
  const resolvedSharedFiltersMap = sharedFiltersMap ?? runtimeProjection.sharedFiltersMap;
  const tabsLayout = 'left' as const;
  const fileActions = undefined;
  const dispatch = useCoreDispatch();

  const [isTransitioning, setIsTransitioning] = React.useState(false);

  useDeepCompareEffect(() => {
    dispatch(setSharedFilters(resolvedSharedFiltersMap ?? {}));
  }, [dispatch, resolvedSharedFiltersMap]);

  // Reset cohort when configuration changes (e.g. switching between different project explorers)
  // this prevents blank pages caused by using a cohort ID that doesn't exist in the new data context
  useDeepCompareEffect(() => {
    setIsTransitioning(true);
    
    // Extensible Fix: Apply preFilters from each tab configuration
    const initialFilters: Record<string, any> = {};
    
    configuration.forEach((panel) => {
      const index = panel.guppyConfig.dataType;
      const tabPreFilters = panel.preFilters;
      
      if (tabPreFilters) {
        const indexFilters: Record<string, any> = { mode: 'and', root: {} };
        Object.entries(tabPreFilters).forEach(([field, values]) => {
          indexFilters.root[field] = {
            operator: 'in',
            field: field,
            operands: Array.isArray(values) ? values : [values],
          };
        });
        initialFilters[index] = indexFilters;
      }
    });

    dispatch(createNewCohort({ filters: initialFilters }));
    // Small delay to allow Redux state to propagate and hooks to reset
    const timer = setTimeout(() => setIsTransitioning(false), 50);
    return () => clearTimeout(timer);
  }, [dispatch, configuration]);

  if (isTransitioning) {
    return null; // Return null during the 50ms transition to avoid "double spinner" overlap with child components
  }

  return (
    <ProtectedContent>
      <div className="flex w-full flex-col">
        <Tabs
          color="primary.4"
          variant={configuration[0]?.tabType}
          // A panel owns several dataframe queries (facets, charts, count,
          // and rows). Mount only the visible panel so opening Explorer does
          // not query every configured output at once.
          keepMounted={false}
          defaultValue={configuration[0]?.tabTitle}
          onChange={onTabChange}
          value={activeTab}
        >
          {!hideTabList ? (
            <Tabs.List
              className="w-full"
              grow
              justify={TabsLayoutToComponentProp(tabsLayout)}
            >
              {configuration.map((panelConfig: CohortPanelConfiguration) => (
                <Tabs.Tab
                  value={panelConfig.tabTitle}
                  key={`${panelConfig.tabTitle}-tabList`}
                >
                  {panelConfig.tabTitle}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          ) : null}

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
                sharedFiltersMap={resolvedSharedFiltersMap ?? undefined}
                fileActions={fileActions}
              />
            </Tabs.Panel>
          ))}
        </Tabs>
      </div>
    </ProtectedContent>
  );
};

export default CohortBuilder;
