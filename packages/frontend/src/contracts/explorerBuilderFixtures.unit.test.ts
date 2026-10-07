import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixtureDirectory = resolve(
  process.cwd(),
  '../../docs/contracts/explorer-builder/v2',
);

describe('Explorer Builder contract fixtures', () => {
  it('matches every fixture against MANIFEST.sha256', () => {
    const manifest = readFileSync(
      resolve(fixtureDirectory, 'MANIFEST.sha256'),
      'utf8',
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    expect(manifest.length).toBeGreaterThan(0);
    for (const line of manifest) {
      const [expectedDigest, fileName] = line.trim().split(/\s+/);
      const digest = createHash('sha256')
        .update(readFileSync(resolve(fixtureDirectory, fileName)))
        .digest('hex');
      expect(digest).toBe(expectedDigest);
    }
  });

  it('strictly decodes the ordered five-table V2 workspace fixture', () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(fixtureDirectory, 'five-table-builder-state.json'),
        'utf8',
      ),
    ) as unknown;
    expect(fixture).toMatchObject({
      apiVersion: 'loom.calypr.org/explorer-authoring/v2',
      kind: 'ExplorerBuilderState',
    });
    const state = fixture as {
      workspace: { tabs: ReadonlyArray<{ outputId: string }> };
    };
    expect(state.workspace.tabs.map((tab) => tab.outputId)).toEqual([
      'patients',
      'specimens',
      'documents',
      'observations',
      'conditions',
    ]);
  });
});
