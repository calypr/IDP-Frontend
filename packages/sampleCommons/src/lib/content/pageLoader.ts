import {
  definePageLoader,
  loadNavigationFromContext,
  type ServerPageContext,
} from '@gen3/frontend';

export const defineSamplePageLoader = <T extends Record<string, any>>(
  name: string,
  load: (context: ServerPageContext) => Promise<T> = async () => ({}) as T,
) =>
  definePageLoader<T>({
    name,
    load,
    loadNavigation: loadNavigationFromContext,
  });
