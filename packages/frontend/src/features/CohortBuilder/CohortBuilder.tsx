import React from 'react';
import { CohortBuilderProps, CohortPanelConfiguration } from './types';
import { Tabs } from '@mantine/core';
import { CohortPanel } from './CohortPanel';
import { ProtectedContent } from '../../components/Protected';
import { selectCurrentCohortId, useCoreSelector } from '@gen3/core';
import { cohortBuilderPanelsFromRuntime } from './explorerRuntime';
import { TabsLayoutToComponentProp } from '../../utils/layout';
import { useExplorerRuntimeStoreSync } from '../../hooks/explorerViewer/useExplorerRuntimeStoreSync';

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
  const runtimeProjection = React.useMemo(
    () => cohortBuilderPanelsFromRuntime(runtime, project),
    [project, runtime],
  );
  const configuration = runtimeProjection.panels;
  const resolvedSharedFiltersMap =
    sharedFiltersMap ?? runtimeProjection.sharedFiltersMap;
  const tabsLayout = 'left' as const;
  const fileActions =
    runtimeProjection.fileActions?.extensions &&
    runtimeProjection.fileActions.actions
      ? {
          extensions: Object.fromEntries(
            Object.entries(runtimeProjection.fileActions.extensions).map(
              ([key, values]) => [key, [...values]],
            ),
          ),
          actions: { ...runtimeProjection.fileActions.actions },
        }
      : undefined;
  const runtimeStoreReady = useExplorerRuntimeStoreSync(
    configuration,
    resolvedSharedFiltersMap,
  );

  if (!runtimeStoreReady) return null;

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
