import fs from 'node:fs';
import path from 'node:path';
import {
  AdminAuthzConfigurationSchema,
  AnalysisToolsConfigurationSchema,
  CrosswalkConfigurationSchema,
  DataLibraryConfigurationSchema,
  DictionaryConfigurationSchema,
  DiscoveryConfigurationSchema,
  DynamicAppConfigurationSchema,
  FileSummaryConfigurationSchema,
  IconRegistryConfigurationSchema,
  LandingConfigurationSchema,
  LoginConfigurationSchema,
  ModalsConfigurationSchema,
  NavPageLayoutConfigurationSchema,
  ProfileConfigurationSchema,
  QueryConfigurationSchema,
  ReportsConfigurationSchema,
  SessionConfigurationSchema,
  SmmartConfigurationSchema,
  SubmissionConfigurationSchema,
  TabbedCohortBuilderConfigurationSchema,
  ThemeColorsConfigurationSchema,
  ThemeFontsConfigurationSchema,
} from './schemas';

const fixtureRoot = path.resolve(__dirname, '../../../../sampleCommons/config');

const readFixture = (relativePath: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8'));

describe('runtime configuration schemas', () => {
  test.each([
    ['gen3/modals.json', ModalsConfigurationSchema],
    ['cbds/modals.json', ModalsConfigurationSchema],
    ['gen3/session.json', SessionConfigurationSchema],
    ['cbds/session.json', SessionConfigurationSchema],
    ['gen3/themeFonts.json', ThemeFontsConfigurationSchema],
    ['cbds/themeFonts.json', ThemeFontsConfigurationSchema],
    ['gen3/themeColors.json', ThemeColorsConfigurationSchema],
    ['cbds/themeColors.json', ThemeColorsConfigurationSchema],
    ['icons/gen3.json', IconRegistryConfigurationSchema],
    ['icons/dataDictionary.json', IconRegistryConfigurationSchema],
    ['icons/workspace.json', IconRegistryConfigurationSchema],
    ['gen3/analysisTools.json', AnalysisToolsConfigurationSchema],
    ['gen3/crosswalk.json', CrosswalkConfigurationSchema],
    ['datacommons/crosswalk.json', CrosswalkConfigurationSchema],
    ['gen3/dictionary.json', DictionaryConfigurationSchema],
    ['gen3/dataLibrary.json', DataLibraryConfigurationSchema],
    ['brh/dataLibrary.json', DataLibraryConfigurationSchema],
    ['gen3/discovery.json', DiscoveryConfigurationSchema],
    ['cbds/discovery.json', DiscoveryConfigurationSchema],
    ['aced/discovery.json', DiscoveryConfigurationSchema],
    ['gen3/landingPage.json', LandingConfigurationSchema],
    ['cbds/calyprLandingPage.json', LandingConfigurationSchema],
    ['gen3/login.json', LoginConfigurationSchema],
    ['aced/login.json', LoginConfigurationSchema],
    ['gen3/profile.json', ProfileConfigurationSchema],
    ['cbds/reports/researchsubject.json', ReportsConfigurationSchema],
    ['cbds/reports/specimen.json', ReportsConfigurationSchema],
    ['cbds/reports/medicationadministration.json', ReportsConfigurationSchema],
    ['gen3/submission.json', SubmissionConfigurationSchema],
    ['cbds/submission.json', SubmissionConfigurationSchema],
    ['gen3/query.json', QueryConfigurationSchema],
    ['cbds/query.json', QueryConfigurationSchema],
    ['brh/query.json', QueryConfigurationSchema],
    ['datacommons/apps/CohortREACT.json', DynamicAppConfigurationSchema],
  ])('accepts fixture %s', (relativePath, schema) => {
    expect(schema.safeParse(readFixture(relativePath))).toMatchObject({
      success: true,
    });
  });

  test('preserves unknown extension fields', () => {
    const result = LoginConfigurationSchema.parse({
      showCredentialsLogin: true,
      vendorExtension: { enabled: true },
    });

    expect(result.vendorExtension).toEqual({ enabled: true });
  });

  test('normalizes legacy Gecko navigation permission and base-page values', () => {
    const result = NavPageLayoutConfigurationSchema.parse({
      headerProps: {
        topBar: { items: [] },
        navigation: { items: [] },
        leftnav: [
          {
            title: 'Home',
            description: 'Home',
            icon: 'home',
            href: '/',
            perms: null,
          },
        ],
      },
      footerProps: {},
    });

    expect(result.headerProps.leftnav).toMatchObject([{ perms: '' }]);
    expect(result.headerProps.basePage).toBe(false);
  });

  test('rejects invalid known fields', () => {
    expect(
      SubmissionConfigurationSchema.safeParse({
        projectTable: { columns: [{ name: 'Subjects', field: 42 }] },
      }).success,
    ).toBe(false);

    expect(
      IconRegistryConfigurationSchema.safeParse({
        prefix: 'gen3',
        lastModified: 'not-a-number',
        icons: {},
      }).success,
    ).toBe(false);
  });

  test('requires the structural fields of v2 Query configuration', () => {
    expect(
      QueryConfigurationSchema.safeParse({
        version: 2,
        endpoints: {},
        modes: [],
        defaultMode: '',
      }).success,
    ).toBe(false);
  });

  test('accepts an empty optional configuration fixture', () => {
    expect(DynamicAppConfigurationSchema.parse({})).toEqual({});
    expect(LandingConfigurationSchema.parse({})).toEqual({});
  });

  test('admin authz schema preserves parsed YAML payloads', () => {
    const result = AdminAuthzConfigurationSchema.parse({
      fence: { USER_YAML: { resources: { '*': ['read'] } } },
    });

    expect(result.fence?.USER_YAML).toEqual({ resources: { '*': ['read'] } });
  });

  test('FileSummary schema accepts its optional configuration fields', () => {
    expect(
      FileSummaryConfigurationSchema.parse({
        binslicePoints: [0, 10],
        config: { name: { title: 'Name' } },
      }),
    ).toMatchObject({ binslicePoints: [0, 10] });
  });

  test('Tabbed Cohort Builder schema validates tabs and index', () => {
    expect(
      TabbedCohortBuilderConfigurationSchema.parse({
        index: 'Patient',
        tabsConfiguration: {
          demographics: {
            label: 'Demographics',
            queryOptions: { indexType: 'Patient' },
            facets: ['gender'],
          },
        },
      }),
    ).toMatchObject({ index: 'Patient' });
  });

  test('SMMART schema validates cards and preserves extensions', () => {
    expect(
      SmmartConfigurationSchema.parse({
        topText: [{ box: 'SMMART' }],
        smmartCards: [
          {
            title: 'Card',
            description: 'Description',
            icon: 'gen3:analysis',
            href: '/analysis',
            vendorExtension: true,
          },
        ],
      }),
    ).toMatchObject({ smmartCards: [{ vendorExtension: true }] });
  });
});
