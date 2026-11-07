import { readJsonFile } from '@nx/devkit';
import { join } from 'node:path';

/** The package root, where `migrations.json` resolves its paths from. */
const PACKAGE_ROOT = join(__dirname, '../..');

interface MigrationEntry {
  readonly version: string;
  readonly description: string;
  readonly implementation: string;
}

const migrations = readJsonFile<{
  generators: Record<string, MigrationEntry>;
}>(join(PACKAGE_ROOT, 'migrations.json'));

describe('migrations.json', () => {
  it.each(Object.entries(migrations.generators))(
    '%s points at a migration with a default export',
    (_name, entry) => {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.description).not.toBe('');

      const migration: { default?: unknown } = require(
        join(PACKAGE_ROOT, entry.implementation)
      );

      expect(typeof migration.default).toBe('function');
    }
  );
});
