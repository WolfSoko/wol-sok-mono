import { addProjectConfiguration, logger, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import generator from '../../generators/application/application';
import { runGeneratedTests } from '../../testing/generated-test';
import updateStarterTest from './update-starter-test';

const TEST_PATH = 'starter/src/main.test.ts';

/** The starter test of 2.7.0 to 4.1.2, as the generator wrote it. */
const CURRENT_STARTER = `import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from './stacks/app-stack';

describe('Infra', () => {
  it('synthesizes an empty stack', () => {
    const app = new App();

    const stack = new AppStack(app, 'infraTestStack');

    Template.fromStack(stack).templateMatches({ Resources: {} });
  });
});
`;

/** The same test after a formatter with double quotes and no semicolons. */
const CURRENT_STARTER_REFORMATTED = `import { App } from "aws-cdk-lib"
import { Template } from "aws-cdk-lib/assertions"
import { AppStack } from "./stacks/app-stack"

describe("Infra", () => {
  it("synthesizes an empty stack", () => {
    const app = new App()

    const stack = new AppStack(app, "infraTestStack")

    Template.fromStack(stack).templateMatches({
      Resources: {},
    })
  })
})
`;

/** The starter test of 1.x to early 2.x. */
const LEGACY_STARTER = `import { Stack, App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from './stacks/app-stack';

test('Empty Stack', () => {
    const app = new App();
    // WHEN
    const stack = new AppStack(app, 'infraTestStack');
    // THEN
    Template.fromStack(stack as Stack).templateMatches({
        Resources: {}
    });
});
`;

/** A starter test the user extended: theirs, with the failing assertion left in. */
const EDITED_STARTER = CURRENT_STARTER.replace(
  "it('synthesizes an empty stack'",
  "it('synthesizes my stack'"
);

/** A test the user wrote that no longer asserts an empty stack. */
const OWN_TEST = `import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from './stacks/app-stack';

test('has a bucket', () => {
  const stack = new AppStack(new App(), 'infraTestStack');
  Template.fromStack(stack).resourceCountIs('AWS::S3::Bucket', 1);
});
`;

async function workspaceWithStarterTest(content: string): Promise<Tree> {
  const tree = createTreeWithEmptyWorkspace();
  await generator(tree, { name: 'starter', skipFormat: true });
  tree.write(TEST_PATH, content);
  return tree;
}

describe('update-starter-test migration', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  /** Runs the migration, counting only its own warnings, not the generator's. */
  async function migrate(tree: Tree): Promise<void> {
    warn.mockClear();
    await updateStarterTest(tree);
  }

  describe.each([
    ['the 2.7.0 to 4.1.2 starter', CURRENT_STARTER, 'Infra'],
    ['a reformatted starter', CURRENT_STARTER_REFORMATTED, 'Infra'],
    ['the legacy starter', LEGACY_STARTER, 'Starter'],
  ])('with %s', (_case, starter, describeName) => {
    let tree: Tree;
    let warnings: unknown[][];

    // The tests only read the migrated tree, so it is built once per shape.
    beforeAll(async () => {
      const migrationWarn = jest
        .spyOn(logger, 'warn')
        .mockImplementation(() => undefined);
      try {
        tree = await workspaceWithStarterTest(starter);
        migrationWarn.mockClear();
        await updateStarterTest(tree);
        warnings = [...migrationWarn.mock.calls];
      } finally {
        migrationWarn.mockRestore();
      }
    });

    it('rewrites it to pass against the workspace aws-cdk-lib without validation warnings', async () => {
      const run = await runGeneratedTests(tree, TEST_PATH);

      expect(run.names).toEqual(['synthesizes an empty stack']);
      expect(run.logged).not.toContain('CloudFormation-Validate');
    });

    it('keeps the stack id and the describe name', () => {
      const migrated = tree.read(TEST_PATH, 'utf-8');

      expect(migrated).toContain("new AppStack(app, 'infraTestStack')");
      expect(migrated).toContain(`describe('${describeName}'`);
      expect(migrated).not.toContain('templateMatches');
    });

    it('warns about nothing', () => {
      expect(warnings).toEqual([]);
    });
  });

  it('leaves an edited test byte for byte and names it when it still fails', async () => {
    const tree = await workspaceWithStarterTest(EDITED_STARTER);

    await migrate(tree);

    expect(tree.read(TEST_PATH, 'utf-8')).toBe(EDITED_STARTER);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(TEST_PATH);
    expect(warn.mock.calls[0][0]).toContain('#420-starter-test-of-older-apps');
  });

  it.each([
    ['an older aws-cdk-lib', '~2.100.0'],
    ['no aws-cdk-lib', undefined],
  ])(
    'leaves the starter test as it is and says why with %s',
    async (_case, cdkLib) => {
      const tree = await workspaceWithStarterTest(CURRENT_STARTER);
      updateJson(tree, 'package.json', (json) => {
        delete json.dependencies?.['aws-cdk-lib'];
        delete json.devDependencies?.['aws-cdk-lib'];
        if (cdkLib) {
          json.dependencies = { ...json.dependencies, 'aws-cdk-lib': cdkLib };
        }
        return json;
      });

      await migrate(tree);

      expect(tree.read(TEST_PATH, 'utf-8')).toBe(CURRENT_STARTER);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain(TEST_PATH);
      expect(warn.mock.calls[0][0]).toContain('aws-cdk-lib');
    }
  );

  it('leaves a test of the user alone without a warning', async () => {
    const tree = await workspaceWithStarterTest(OWN_TEST);

    await migrate(tree);

    expect(tree.read(TEST_PATH, 'utf-8')).toBe(OWN_TEST);
    expect(warn).not.toHaveBeenCalled();
  });

  it('passes over projects without a main.test.ts and workspaces without CDK apps', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'web', { root: 'apps/web' });
    tree.write('apps/web/src/main.ts', 'export {};\n');
    const before = tree.listChanges().map((change) => change.path);

    await migrate(tree);

    expect(tree.listChanges().map((change) => change.path)).toEqual(before);
    expect(warn).not.toHaveBeenCalled();
  });
});
