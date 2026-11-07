import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';

import generator from './application';
import { ApplicationSchema } from './schema';

describe('aws-cdk generator', () => {
  let appTree: Tree;
  const options: ApplicationSchema = { name: 'test' };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await generator(appTree, options);
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toBeDefined();
  });

  it('should register executors on generated project', async () => {
    await generator(appTree, options);
    const config = readProjectConfiguration(appTree, 'test');

    expect(config.targets?.deploy?.executor).toBe(
      '@wolsok/nx-aws-cdk-v2:deploy'
    );
    expect(config.targets?.synth?.executor).toBe('@wolsok/nx-aws-cdk-v2:synth');
    expect(config.targets?.destroy?.executor).toBe(
      '@wolsok/nx-aws-cdk-v2:destroy'
    );
    expect(config.targets?.bootstrap?.executor).toBe(
      '@wolsok/nx-aws-cdk-v2:bootstrap'
    );
  });

  it('directory option', async () => {
    const directory = 'sub';
    const directoryOptions = Object.assign({}, options);
    directoryOptions.directory = directory;

    await generator(appTree, directoryOptions);
    const config = readProjectConfiguration(appTree, 'sub-test');
    expect(config).toBeDefined();
  });

  describe('tsconfig.json', () => {
    const extendsOf = (path: string): string => readJson(appTree, path).extends;

    beforeEach(() => {
      // An apps/ folder puts the project two levels below the root.
      appTree.write('apps/.gitkeep', '');
    });

    it('extends tsconfig.base.json when the workspace has no tsconfig.cdk.json', async () => {
      await generator(appTree, options);

      expect(extendsOf('apps/test/tsconfig.json')).toBe(
        '../../tsconfig.base.json'
      );
    });

    it('extends tsconfig.cdk.json when the workspace root has one', async () => {
      writeJson(appTree, 'tsconfig.cdk.json', {
        extends: './tsconfig.base.json',
      });

      await generator(appTree, options);

      expect(extendsOf('apps/test/tsconfig.json')).toBe(
        '../../tsconfig.cdk.json'
      );
      expect(extendsOf('apps/test/tsconfig.app.json')).toBe('./tsconfig.json');
      expect(extendsOf('apps/test/tsconfig.spec.json')).toBe('./tsconfig.json');
    });

    it('extends tsconfig.cdk.json from a nested directory', async () => {
      writeJson(appTree, 'tsconfig.cdk.json', {
        extends: './tsconfig.base.json',
      });

      await generator(appTree, { ...options, directory: 'sub' });

      expect(extendsOf('apps/sub/test/tsconfig.json')).toBe(
        '../../../tsconfig.cdk.json'
      );
    });

    it('sets its own NodeNext module settings, independent of the root', async () => {
      await generator(appTree, options);

      const { compilerOptions } = readJson(appTree, 'apps/test/tsconfig.json');
      expect(compilerOptions.module).toBe('NodeNext');
      expect(compilerOptions.moduleResolution).toBe('NodeNext');
    });
  });

  describe('types', () => {
    const typesOf = (path: string): string[] =>
      readJson(appTree, path).compilerOptions.types;

    beforeEach(() => {
      appTree.write('apps/.gitkeep', '');
    });

    it('lists no jest types without a unit test runner', async () => {
      await generator(appTree, { ...options, unitTestRunner: 'none' });

      expect(typesOf('apps/test/tsconfig.json')).toEqual(['node']);
      expect(typesOf('apps/test/tsconfig.app.json')).toEqual(['node']);
      expect(appTree.exists('apps/test/tsconfig.spec.json')).toBe(false);
    });

    it('keeps the jest types in tsconfig.spec.json only', async () => {
      await generator(appTree, options);

      expect(typesOf('apps/test/tsconfig.json')).toEqual(['node']);
      expect(typesOf('apps/test/tsconfig.app.json')).toEqual(['node']);
      expect(typesOf('apps/test/tsconfig.spec.json')).toContain('jest');
    });
  });

  describe('tsconfig.spec.json in a TS-solution workspace', () => {
    const specExtends = (): string =>
      readJson(appTree, 'apps/test/tsconfig.spec.json').extends;

    beforeEach(() => {
      appTree.write('apps/.gitkeep', '');
      writeJson(appTree, 'package.json', {
        name: 'consumer',
        workspaces: ['apps/*'],
      });
      writeJson(appTree, 'tsconfig.base.json', {
        compilerOptions: { composite: true, declaration: true },
      });
      writeJson(appTree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('extends tsconfig.cdk.json when the workspace root has one', async () => {
      writeJson(appTree, 'tsconfig.cdk.json', {
        extends: './tsconfig.base.json',
      });

      await generator(appTree, options);

      expect(specExtends()).toBe('../../tsconfig.cdk.json');
    });

    it('extends tsconfig.cdk.json from a nested directory', async () => {
      writeJson(appTree, 'tsconfig.cdk.json', {
        extends: './tsconfig.base.json',
      });

      await generator(appTree, { ...options, directory: 'sub' });

      expect(
        readJson(appTree, 'apps/sub/test/tsconfig.spec.json').extends
      ).toBe('../../../tsconfig.cdk.json');
    });

    it('keeps tsconfig.base.json when the workspace has no tsconfig.cdk.json', async () => {
      await generator(appTree, options);

      expect(specExtends()).toBe('../../tsconfig.base.json');
    });
  });
});
