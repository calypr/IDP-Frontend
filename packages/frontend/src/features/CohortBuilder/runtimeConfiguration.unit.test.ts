import { normalizeCohortPanelForDataset } from './runtimeConfiguration';

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
});
