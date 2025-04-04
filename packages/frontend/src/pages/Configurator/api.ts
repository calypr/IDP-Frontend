// api.ts
import { GEN3_API } from '@gen3/core';
import { type ApiResponse } from './types';
import { type CohortPanelConfig } from '../../features/CohortBuilder';

export const fetchConfigContent = async (
  name: string,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const url = `${GEN3_API}/ExplorerConfig/${name}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }

    const config = await response.json();
    return { success: true, data: config };
  } catch (err) {
    console.error('Error fetching explorer config:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

export const postConfigContent = async (
  name: string,
  configData: CohortPanelConfig[],
): Promise<ApiResponse> => {
  try {
    const url = `${GEN3_API}/ExplorerConfig/${name}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(configData, null, 2),
    });

    if (!response.ok) {
      throw new Error(`Failed to post config: ${response.status}`);
    }

    const config = await response.json();
    console.log('CONFIG: ', config);
    return { success: true };
  } catch (err) {
    console.error('Error posting explorer config:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};
