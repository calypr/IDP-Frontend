import { z } from 'zod';

/** JSON values are used for configuration extension points and render data. */
export const JsonValueSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
export const UnknownObjectSchema = z.object({}).passthrough();
export const StringRecordSchema = z.record(z.string(), z.string());

const ClassNamesSchema = z.record(z.string(), z.unknown());

const NavigationButtonSchema = z
  .object({
    icon: z.string().optional(),
    tooltip: z.string().optional(),
    href: z.string().optional(),
    noBasePath: z.boolean().optional(),
    name: z.string().optional(),
    iconHeight: z.string().optional(),
    classNames: ClassNamesSchema.optional(),
  })
  .passthrough();

const NavigationLogoSchema = z
  .object({
    src: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    noBasePath: z.boolean().optional(),
    divider: z.boolean().optional(),
    basePath: z.string().optional(),
    href: z.string().optional(),
    classNames: ClassNamesSchema.optional(),
    basepage: z.boolean().optional(),
  })
  .passthrough();

const LeftNavigationItemSchema: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      href: z.string().optional(),
      perms: z
        .string()
        .nullish()
        .transform((value) => value ?? ''),
      subItems: z.array(LeftNavigationItemSchema).optional(),
      dynamicProps: UnknownObjectSchema.optional(),
    })
    .passthrough(),
);

export const NavigationConfigurationSchema = z
  .object({
    navigation: z
      .object({
        logo: NavigationLogoSchema.optional(),
        items: z.array(NavigationButtonSchema).optional(),
        title: z.string().optional(),
        classNames: ClassNamesSchema.optional(),
      })
      .passthrough()
      .optional(),
    topBar: UnknownObjectSchema.optional(),
    leftnav: z.array(LeftNavigationItemSchema).optional(),
    banners: z.array(UnknownObjectSchema).optional(),
  })
  .passthrough();

/** Combined navigation payload returned by Gecko's `/config/nav/:id`. */
export const NavPageLayoutConfigurationSchema = z
  .object({
    headerProps: z
      .object({
        topBar: z
          .object({ items: z.array(NavigationButtonSchema) })
          .passthrough(),
        navigation: z
          .object({ items: z.array(NavigationButtonSchema).optional() })
          .passthrough(),
        leftnav: z.array(LeftNavigationItemSchema),
        banners: z.array(UnknownObjectSchema).optional(),
        basePage: z.boolean().default(false),
      })
      .passthrough(),
    footerProps: UnknownObjectSchema,
    fileActions: UnknownObjectSchema.optional(),
    dynamicProps: UnknownObjectSchema.optional(),
  })
  .passthrough();

export const ModalsConfigurationSchema = z
  .object({
    systemUseModal: z
      .object({
        enabled: z.boolean().optional(),
        title: z.string().optional(),
        content: JsonValueSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const SessionConfigurationSchema = z
  .object({
    updateSessionTime: z.number().optional(),
    inactiveTimeLimit: z.number().optional(),
    logoutInactiveUsers: z.boolean().optional(),
    refetchOnWindowFocus: z.boolean().optional(),
    workspaceInactivityTimeLimit: z.number().optional(),
    sessionConfig: UnknownObjectSchema.optional(),
  })
  .passthrough();

const FontValueSchema = z.union([z.string(), z.array(z.string())]);

export const ThemeFontsConfigurationSchema = z
  .object({
    heading: FontValueSchema.optional(),
    content: FontValueSchema.optional(),
    fontFamily: z.string().optional(),
  })
  .passthrough();

export const ThemeColorsConfigurationSchema = JsonObjectSchema;

export const IconRegistryConfigurationSchema = z
  .object({
    prefix: z.string(),
    lastModified: z.number(),
    icons: z.record(
      z.string(),
      z
        .object({
          body: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          top: z.number().optional(),
          left: z.number().optional(),
        })
        .passthrough(),
    ),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .passthrough();

const AnalysisToolSchema = z
  .object({
    title: z.string(),
    type: z.string(),
    description: z.string(),
    loginRequired: z.boolean(),
    href: z.string(),
    icon: JsonValueSchema.optional(),
    image: z.string().optional(),
    hasDemo: z.boolean().optional(),
    appId: z.string().optional(),
    componentName: z.string().optional(),
    count: z.number().optional(),
    countIndex: z.string().optional(),
    countUnits: z.string().optional(),
    noDataTooltip: z.string().optional(),
    cardType: z.enum(['regular', 'compact']).optional(),
    btnText: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const AnalysisToolsConfigurationSchema = z
  .object({ tools: z.array(AnalysisToolSchema).optional() })
  .passthrough();

export const AnalysisConfigurationSchema = z.union([
  AnalysisToolsConfigurationSchema,
  z
    .object({
      analysis: JsonValueSchema.optional(),
      sections: z.array(UnknownObjectSchema).optional(),
      classNames: ClassNamesSchema.optional(),
    })
    .passthrough(),
]);

export const DictionaryConfigurationSchema = z
  .object({
    showGraph: z.boolean().optional(),
    showDownloads: z.boolean().optional(),
    historyStorageId: z.string().optional(),
    maxHistoryItems: z.number().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    headerMetadata: UnknownObjectSchema.optional(),
  })
  .passthrough();

const DataLibraryActionSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
  })
  .passthrough();

export const DataLibraryConfigurationSchema = z
  .object({
    useAPI: z.boolean().optional(),
    storageMode: z.string().optional(),
    requiresLogin: z.boolean().optional(),
    size: z.string().optional(),
    actions: z.array(DataLibraryActionSchema).optional(),
    fileTable: UnknownObjectSchema.optional(),
    selectionTable: UnknownObjectSchema.optional(),
  })
  .passthrough();

const DiscoveryIndexConfigurationSchema = z
  .object({
    guidType: z.string().optional(),
    studyField: z.string().optional(),
    maxStudies: z.number().optional(),
    label: z.string().optional(),
    tabType: z.enum(['pills', 'outline']).optional(),
    features: UnknownObjectSchema.optional(),
    aggregations: z.array(JsonValueSchema).optional(),
    tags: JsonValueSchema.optional(),
    tableConfig: UnknownObjectSchema.optional(),
    studyColumns: z.array(JsonValueSchema).optional(),
    studyPreviewField: JsonValueSchema.optional(),
    simpleDetailsView: JsonValueSchema.optional(),
    detailView: JsonValueSchema.optional(),
    minimalFieldMapping: UnknownObjectSchema.optional(),
  })
  .passthrough();

export const DiscoveryConfigurationSchema = z.union([
  z
    .object({
      metadataConfig: z.array(DiscoveryIndexConfigurationSchema),
    })
    .passthrough(),
  DiscoveryIndexConfigurationSchema,
]);

export const FileSummaryConfigurationSchema = z
  .object({
    barChartColor: z.string().optional(),
    binslicePoints: z.array(z.number()).optional(),
    config: z.record(z.string(), UnknownObjectSchema).optional(),
    defaultPath: z.string().optional(),
    defaultProject: z.string().optional(),
    idField: z.string().optional(),
    index: z.string().optional(),
    maxTraversalPages: z.number().optional(),
  })
  .passthrough();

export const LandingConfigurationSchema = z
  .object({
    body: z.array(JsonValueSchema).optional(),
  })
  .passthrough();

export const ResourceConfigurationSchema = z.union([
  LandingConfigurationSchema,
  UnknownObjectSchema,
]);

const LoginContentSchema = z
  .object({
    text: z.string().optional(),
    email: z.string().optional(),
    className: z.string().optional(),
    image: z
      .object({ src: z.string(), alt: z.string() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const LoginConfigurationSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    text: z.string().optional(),
    contact: z.string().optional(),
    email: z.string().optional(),
    image: z.string().optional(),
    className: z.string().optional(),
    topContent: z.array(LoginContentSchema).optional(),
    bottomContent: z.array(LoginContentSchema).optional(),
    showCredentialsLogin: z.boolean().optional(),
  })
  .passthrough();

export const SmmartConfigurationSchema = z
  .object({
    topText: z.array(z.object({ box: z.string() }).passthrough()),
    smmartCards: z.array(
      z
        .object({
          title: z.string(),
          description: z.string(),
          icon: z.string(),
          href: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const ProfileConfigurationSchema = z
  .object({
    hasExternalLogins: z.boolean().optional(),
    resourceTable: UnknownObjectSchema.optional(),
  })
  .passthrough();

export const ReportsConfigurationSchema = z
  .object({
    Title: z.string().optional(),
    tableConfig: UnknownObjectSchema.optional(),
  })
  .passthrough();

export const SubmissionConfigurationSchema = z
  .object({
    projectTable: z
      .object({
        columns: z
          .array(
            z
              .object({
                name: z.string(),
                field: z.string(),
                errorIfNotAvailable: z.boolean().optional(),
                valueIfNotAvailable: z.union([z.string(), z.number()]).optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const TabbedCohortBuilderConfigurationSchema = z
  .object({
    index: z.string(),
    loomDataset: z
      .object({
        recipe: z.string().min(1),
        translationVersion: z.string().min(1),
        output: z.string().min(1),
      })
      .passthrough()
      .optional(),
    tabsConfiguration: z.record(
      z.string(),
      z
        .object({
          label: z.string(),
          queryOptions: z
            .object({ indexType: z.string() })
            .passthrough(),
          facets: z.array(z.string()),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const WorkspaceConfigurationSchema = z
  .object({
    title: z.string().optional(),
    workspaceInfo: z.record(z.string(), UnknownObjectSchema).optional(),
    launchStepIndicatorConfig: z
      .object({
        steps: z.array(UnknownObjectSchema),
      })
      .passthrough()
      .optional(),
    requirePayModel: z.boolean().optional(),
  })
  .passthrough();

const QueryEndpointSchema = z
  .object({
    url: z.string().min(1),
    service: z.enum(['loom', 'guppy', 'generic']),
    surface: z.enum(['graph', 'flat', 'graphql']),
  })
  .passthrough();

const QueryModeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    endpoint: z.string().min(1),
    preset: z.enum([
      'loom-fhir-graph',
      'loom-fhir-dataframe',
      'loom-flat',
      'guppy-flat',
      'generic',
    ]),
    defaultQuery: z.string().optional(),
    defaultVariables: JsonObjectSchema.optional(),
  })
  .passthrough();

export const QueryV2ConfigurationSchema = z
  .object({
    version: z.literal(2),
    endpoints: z.record(z.string(), QueryEndpointSchema),
    modes: z.array(QueryModeSchema),
    defaultMode: z.string().min(1),
  })
  .passthrough();

export const LegacyQueryConfigurationSchema = z
  .object({
    graphQLEndpoint: z.string().min(1).optional(),
  })
  .passthrough()
  .refine((value) => !('version' in value), {
    message: 'versioned Query configurations must use the v2 shape',
    path: ['version'],
  });

export const QueryConfigurationSchema = z.union([
  QueryV2ConfigurationSchema,
  LegacyQueryConfigurationSchema,
]);

export const CrosswalkConfigurationSchema = z
  .object({
    showSubmittedIdInTable: z.boolean().optional(),
    mapping: z
      .object({
        source: z
          .object({ id: z.string(), label: z.string(), description: z.string().optional() })
          .passthrough(),
        external: z.array(
          z
            .object({
              id: z.string(),
              label: z.string(),
              description: z.string().optional(),
              dataPath: z.union([z.string(), z.array(z.string())]),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
    idEntryPlaceholderText: z.string().optional(),
  })
  .passthrough();

export const DynamicAppConfigurationSchema = UnknownObjectSchema;

export const AdminAuthzConfigurationSchema = z
  .object({
    fence: z
      .object({ USER_YAML: JsonValueSchema.optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type JsonValue = z.infer<typeof JsonValueSchema>;
