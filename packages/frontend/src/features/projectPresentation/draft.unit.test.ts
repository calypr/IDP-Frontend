import { buildProjectPresentationDraft } from './draft';

describe('projectPresentation draft builder', () => {
  it('prefers project summary metadata when building the initial draft', () => {
    const draft = buildProjectPresentationDraft({
      organization: 'HTAN_INT',
      project: 'BForePC',
      projectConfig: {
        contact_email: 'config@example.org',
        description: 'Config description',
        org_title: 'HTAN',
        project_title: 'Config title',
        src_repo: 'https://example.org/repo.git',
        title: 'Config title',
      },
      projectRecord: {
        contact_email: 'record@example.org',
        description: 'Record description',
        organization: 'HTAN_INT',
        project: 'BForePC',
        resourcePath: '/programs/HTAN_INT/projects/BForePC',
        thumbnail_url: 'https://example.org/record.png',
        title: 'Record title',
      },
      projectSummary: {
        contact_email: 'summary@example.org',
        description: 'Summary description',
        organization: 'HTAN_INT',
        project: 'BForePC',
        thumbnail_url: 'https://example.org/summary.png',
        title: 'Summary title',
      },
    });

    expect(draft.hero.title).toBe('Summary title');
    expect(draft.hero.summary).toBe('Summary description');
    expect(draft.hero.thumbnailURL).toBe('https://example.org/summary.png');
    expect(draft.bodyHTML).toBe('');
  });

  it('preserves caller supplied body html', () => {
    const draft = buildProjectPresentationDraft({
      bodyHTML: '<section><p>Custom html</p></section>',
      organization: 'HTAN_INT',
      project: 'BForePC',
    });

    expect(draft.bodyHTML).toBe('<section><p>Custom html</p></section>');
  });

  it('falls back to route-derived defaults when metadata is missing', () => {
    const draft = buildProjectPresentationDraft({
      organization: 'HTAN_INT',
      project: 'BForePC',
    });

    expect(draft.hero.title).toBe('BForePC');
    expect(draft.hero.organization).toBe('HTAN_INT');
    expect(draft.hero.summary).toMatch(/presentation workspace/i);
    expect(draft.bodyHTML).toBe('');
  });
});
