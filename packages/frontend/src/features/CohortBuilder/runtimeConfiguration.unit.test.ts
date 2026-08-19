import {
  hasUsableFilterConfiguration,
  normalizeCohortPanelForDataset,
} from './runtimeConfiguration';

describe('hasUsableFilterConfiguration', () => {
  it('only enables filter surfaces when a tab has a field', () => {
    expect(hasUsableFilterConfiguration(undefined)).toBe(false);
    expect(hasUsableFilterConfiguration({ tabs: [] })).toBe(false);
    expect(
      hasUsableFilterConfiguration({
        tabs: [{ title: 'Filters', fields: [], fieldsConfig: {} }],
      }),
    ).toBe(false);
    expect(
      hasUsableFilterConfiguration({
        tabs: [{ title: 'Filters', fields: ['status'], fieldsConfig: {} }],
      }),
    ).toBe(true);
  });
});

describe('normalizeCohortPanelForDataset', () => {
  const columns = [
    { name: 'id', filterable: false, chartable: false },
    { name: 'status', filterable: true, chartable: true },
  ];

  it('drops stale executable references while preserving presentation overrides', () => {
    const panel = normalizeCohortPanelForDataset(
      {
        tabTitle: 'Patients',
        guppyConfig: { dataType: 'Patient' },
        table: {
          enabled: true,
          fields: ['missing', 'status'],
          columns: {
            missing: { field: 'missing', title: 'Old field' },
            status: { field: 'status', title: 'Current status' },
          },
        },
        filters: {
          tabs: [
            {
              title: 'Filters',
              fields: ['missing', 'status'],
              fieldsConfig: {
                status: {
                  field: 'status',
                  index: 'Patient',
                  label: 'Status label',
                  type: 'enum',
                },
              },
            },
          ],
        },
        charts: {
          missing: { chartType: 'pie' },
          status: { chartType: 'pie', title: 'Status chart' },
        },
        preFilters: { missing: ['value'], status: ['active'] },
      },
      columns,
    );

    expect(panel.table?.fields).toEqual(['status']);
    expect(panel.table?.columns).toEqual({
      status: { field: 'status', title: 'Current status' },
    });
    expect(panel.filters?.tabs[0]?.fields).toEqual(['status']);
    expect(panel.filters?.tabs[0]?.fieldsConfig.status?.label).toBe(
      'Status label',
    );
    expect(panel.charts).toEqual({
      status: { chartType: 'pie', title: 'Status chart' },
    });
    expect(panel.preFilters).toEqual({ status: ['active'] });
  });

  it('uses the live public columns when every saved table field is stale', () => {
    const panel = normalizeCohortPanelForDataset(
      {
        tabTitle: 'Patients',
        guppyConfig: { dataType: 'Patient' },
        table: {
          enabled: true,
          fields: ['old_identifier'],
          columns: {
            old_identifier: {
              field: 'old_identifier',
              title: 'Old identifier',
            },
          },
        },
      },
      columns,
    );

    expect(panel.table?.fields).toEqual(['id', 'status']);
    expect(panel.table?.columns).toEqual({
      id: { field: 'id', title: 'id' },
      status: { field: 'status', title: 'status' },
    });
    expect(
      Object.prototype.hasOwnProperty.call(
        panel.guppyConfig,
        'accessibleFieldCheckList',
      ),
    ).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(panel, 'filters')).toBe(false);
  });

  it('maps logical fields to qualified physical columns before filtering presentation settings', () => {
    const panel = normalizeCohortPanelForDataset(
      {
        tabTitle: 'Patients',
        guppyConfig: { dataType: 'Patient' },
        table: {
          enabled: true,
          fields: ['identifier', 'id'],
          columns: {
            identifier: { field: 'identifier', title: 'Participant ID' },
            id: { field: 'id', title: 'Internal ID' },
          },
        },
        filters: {
          tabs: [
            {
              title: 'Filters',
              fields: ['identifier'],
              fieldsConfig: {
                identifier: {
                  field: 'identifier',
                  index: 'Patient',
                  label: 'Participant ID',
                  type: 'enum',
                },
              },
            },
          ],
        },
        charts: { identifier: { chartType: 'pie', title: 'Participants' } },
        preFilters: { identifier: ['HTA201_3'] },
      },
      [
        {
          name: 'research_subject_identifier',
          semanticPath: 'ResearchSubject.identifier[].value',
          filterable: true,
          chartable: true,
        },
        {
          name: 'research_subject_id',
          semanticPath: 'ResearchSubject.id',
          filterable: false,
          chartable: false,
        },
        {
          name: 'patient__patient_id',
          semanticPath: 'Patient.id',
          filterable: true,
          chartable: true,
        },
      ],
      'ResearchSubject',
    );

    expect(panel.table?.fields).toEqual([
      'research_subject_identifier',
      'research_subject_id',
    ]);
    expect(panel.table?.columns).toEqual({
      research_subject_identifier: {
        field: 'research_subject_identifier',
        title: 'Participant ID',
      },
      research_subject_id: {
        field: 'research_subject_id',
        title: 'Internal ID',
      },
    });
    expect(panel.filters?.tabs[0]).toMatchObject({
      fields: ['research_subject_identifier'],
      fieldsConfig: {
        research_subject_identifier: {
          field: 'research_subject_identifier',
          label: 'Participant ID',
        },
      },
    });
    expect(panel.charts).toEqual({
      research_subject_identifier: {
        chartType: 'pie',
        title: 'Participants',
      },
    });
    expect(panel.preFilters).toEqual({
      research_subject_identifier: ['HTA201_3'],
    });
  });

  it('accepts Loom EmittedColumn default JSON field names', () => {
    const panel = normalizeCohortPanelForDataset(
      {
        tabTitle: 'Patients',
        guppyConfig: { dataType: 'Patient' },
        table: {
          enabled: true,
          fields: ['identifier'],
          columns: {
            identifier: { field: 'identifier', title: 'Participant ID' },
          },
        },
      },
      [
        {
          OutputID: 'Patient',
          SelectionID: 'ResearchSubject.identifier[].value',
          PublicColumn: 'research_subject_identifier',
          Filterable: true,
          Chartable: true,
        } as never,
      ],
      'ResearchSubject',
    );

    expect(panel.table?.fields).toEqual(['research_subject_identifier']);
    expect(panel.table?.columns).toEqual({
      research_subject_identifier: {
        field: 'research_subject_identifier',
        title: 'Participant ID',
      },
    });
  });
});
