import {
  createServerPageContext,
  Fonts,
  RegisteredIcons,
  SessionConfiguration,
  TenStringArray,
} from '@gen3/frontend';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import type { AppContext } from 'next/app';
import { z } from 'zod';

const ObjectConfigurationSchema = z.object({}).passthrough();
const ThemeColorsSchema = z.record(
  z.string(),
  z.record(z.string(), z.string()),
);
const IconSchema = z
  .object({
    prefix: z.string(),
    lastModified: z.number(),
    icons: z.record(z.string(), z.object({}).passthrough()),
  })
  .passthrough();

export const loadContent = async (appContext: AppContext) => {
  const context = createServerPageContext(
    appContext.ctx as any,
    async () => ({}),
  );
  const modals = await context.config.load({
    id: 'modals',
    source: 'content',
    resolvePath: () => `${GEN3_COMMONS_NAME}/modals.json`,
    schema: ObjectConfigurationSchema,
  });
  const session = await context.config.load({
    id: 'session',
    source: 'content',
    resolvePath: () => `${GEN3_COMMONS_NAME}/session.json`,
    schema: ObjectConfigurationSchema,
  });
  const fonts = await context.config.load({
    id: 'themeFonts',
    source: 'content',
    resolvePath: () => `${GEN3_COMMONS_NAME}/themeFonts.json`,
    schema: ObjectConfigurationSchema,
  });
  const themeColors = await context.config.load({
    id: 'themeColors',
    source: 'content',
    resolvePath: () => `${GEN3_COMMONS_NAME}/themeColors.json`,
    schema: ThemeColorsSchema,
  });

  const colors = Object.fromEntries(
    Object.entries(themeColors).map(([key, values]) => {
      const stringValues = values as { [s: string]: string };
      return [key, Object.values(stringValues) as TenStringArray];
    }),
  );

  const icons = await context.content.getAll(
    `icons/`,
    '\\.json',
  );

  return {
    modalsConfig: modals,
    sessionConfig: (
      'sessionConfig' in session
        ? (session as { sessionConfig: unknown }).sessionConfig
        : session
    ) as unknown as SessionConfiguration,
    themeFonts: fonts as unknown as Fonts,
    colors: colors,
    icons: icons.map((icon) => IconSchema.parse(icon)) as unknown as RegisteredIcons[],
  };
};
