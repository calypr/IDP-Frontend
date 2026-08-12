import {
  activateExplorerRevisionPath,
  buildExplorerDraftBody,
  buildExplorerValidationBody,
  explorerRevisionCollectionPath,
  explorerRevisionPath,
  normalizeBuilderApiError,
  normalizeProjectRecipeDraft,
  normalizeRecipeDraftPreview,
} from './explorerBuilderApi';
import { GEN3_GECKO_API } from '../../constants';

describe('normalizeBuilderApiError', () => {
  it('preserves conflict metadata and maps Loom fieldPath to configPath', () => {
    expect(
      normalizeBuilderApiError({
        status: 409,
        data: {
          currentVersion: 7,
          currentDigest: 'sha256-current',
          updatedAt: '2026-08-11T00:00:00Z',
          diagnostics: [
            {
              severity: 'error',
              code: 'DRAFT_CONFLICT',
              fieldPath: 'outputs.0.fields.2',
              message: 'The draft changed.',
            },
          ],
        },
      }),
    ).toMatchObject({
      status: 409,
      retryable: false,
      currentVersion: 7,
      currentDigest: 'sha256-current',
      diagnostics: [{ configPath: 'outputs.0.fields.2' }],
    });
  });

  it('marks transient infrastructure failures retryable', () => {
    expect(
      normalizeBuilderApiError({ status: 503, data: undefined }).retryable,
    ).toBe(true);
  });
});

describe('builder wire-shape normalization', () => {
  const explorer = {
    organization: 'acme',
    project: 'cancer-study',
    configId: 'patient-overview',
  } as const;

  it('uses revision collection and revision-specific activation routes', () => {
    expect(explorerRevisionCollectionPath(explorer)).toBe(
      `${GEN3_GECKO_API}/builder/projects/acme/cancer-study/explorers/patient-overview/revisions`,
    );
    expect(explorerRevisionPath({ ...explorer, revisionId: 'rev-1' })).toBe(
      `${GEN3_GECKO_API}/builder/projects/acme/cancer-study/explorers/patient-overview/revisions/rev-1`,
    );
    expect(
      activateExplorerRevisionPath({ ...explorer, revisionId: 'rev-1' }),
    ).toContain('/revisions/rev-1/activate');
  });

  it('keeps Explorer authoring under the frozen config field', () => {
    expect(buildExplorerDraftBody({ schemaVersion: 1, tabs: [] })).toEqual({
      config: { schemaVersion: 1, tabs: [] },
    });
    expect(
      buildExplorerValidationBody({ schemaVersion: 1, tabs: [] }, 'rev-1'),
    ).toEqual({
      config: { schemaVersion: 1, tabs: [] },
      recipeRevisionId: 'rev-1',
    });
  });

  it('marks a version-zero default draft as platform-default', () => {
    expect(
      normalizeProjectRecipeDraft({
        project: 'acme/cancer-study',
        draftVersion: 0,
        document: { translationVersion: 'draft' },
        authoringDigest: 'sha256:default',
      }),
    ).toMatchObject({ source: 'platform-default', draftVersion: 0 });
  });

  it('selects the requested output from Loom preview outputs', () => {
    expect(
      normalizeRecipeDraftPreview(
        {
          name: 'project_recipe',
          recipeDigest: 'sha256:recipe',
          resolvedSchemaDigest: 'sha256:schema',
          sourceGeneration: 'generation-42',
          outputs: [
            { name: 'Other', columns: ['id'], rows: [{ id: 'other' }] },
            { name: 'Patients', columns: ['id'], rows: [{ id: 'patient-1' }] },
          ],
        },
        'Patients',
      ),
    ).toMatchObject({
      output: 'Patients',
      columns: [{ name: 'id', logicalType: 'string' }],
      rows: [{ id: 'patient-1' }],
      validation: { recipeDigest: 'sha256:recipe' },
    });
  });
});
