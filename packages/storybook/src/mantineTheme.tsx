import { createTheme, mergeThemeOverrides } from '@mantine/core';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { TenStringArray, createMantineTheme } from '@gen3/frontend';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const themeColors: Record<string, TenStringArray> = require(
  `../../sampleCommons/config/${GEN3_COMMONS_NAME}/themeColors.json`,
);

const gen3Theme = createMantineTheme(
  {
    heading: ['Lato', 'sans-serif'],
    content: ['Lato', 'sans-serif'],
    fontFamily: 'Lato',
  },
  themeColors,
);

const localTheme = createTheme({
  components: {
    /*Add components overrides here},*/
  },
  breakpoints: {
    xs: '30em',
    sm: '48em',
    md: '64em',
    lg: '74em',
    xl: '90em',
  },
});

export default mergeThemeOverrides(gen3Theme, localTheme);
