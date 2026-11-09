import { readJsonFile } from '@nx/devkit';
import { join } from 'node:path';

import { CDK_LIB_VERSION } from '../utils/cdk-shared';

/** The package root, where `migrations.json` resolves its paths from. */
const PACKAGE_ROOT = join(__dirname, '../..');

interface MigrationEntry {
  readonly version: string;
  readonly description: string;
  readonly implementation: string;
}

interface PackageUpdate {
  readonly version: string;
  readonly alwaysAddToPackageJson?: boolean;
}

const migrations = readJsonFile<{
  generators: Record<string, MigrationEntry>;
  packageJsonUpdates: Record<
    string,
    { version: string; packages: Record<string, PackageUpdate> }
  >;
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

  it('raises aws-cdk-lib to the version the 4.2.0 starter test is written for', () => {
    const update = migrations.packageJsonUpdates['4.2.0'];

    expect(update.version).toBe('4.2.0');
    expect(update.packages['aws-cdk-lib']).toEqual({
      version: CDK_LIB_VERSION,
      alwaysAddToPackageJson: false,
    });
  });
});
