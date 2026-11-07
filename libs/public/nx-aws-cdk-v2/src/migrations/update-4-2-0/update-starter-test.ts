import * as path from 'path';
import {
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  logger,
  names,
  readJson,
  Tree,
} from '@nx/devkit';

import { CDK_LIB_VERSION } from '../../utils/cdk-shared';

/** The starter test's place in a project, as the application generator writes it. */
const STARTER_TEST = 'src/main.test.ts';

/** The generator's own starter test template, written in place of the old one. */
const STARTER_TEMPLATE_DIR = path.join(
  __dirname,
  '../../generators/application/jest-files'
);

/** Stand-ins for the names a starter test carries, in the shapes below. */
const DESCRIBE_NAME = '__DESCRIBE_NAME__';
const STACK_PREFIX = '__STACK_PREFIX__';

/** The starter test of 2.7.0 to 4.1.2. */
const DESCRIBE_SHAPE = `import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from './stacks/app-stack';

describe('${DESCRIBE_NAME}', () => {
  it('synthesizes an empty stack', () => {
    const app = new App();

    const stack = new AppStack(app, '${STACK_PREFIX}TestStack');

    Template.fromStack(stack).templateMatches({ Resources: {} });
  });
});
`;

/** The starter test of 1.x to early 2.x. */
const LEGACY_SHAPE = `import { Stack, App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from './stacks/app-stack';

test('Empty Stack', () => {
    const app = new App();
    // WHEN
    const stack = new AppStack(app, '${STACK_PREFIX}TestStack');
    // THEN
    Template.fromStack(stack as Stack).templateMatches({
        Resources: {}
    });
});
`;

/** A version as `[major, minor, patch]`. */
type Version = readonly [number, number, number];

/** The first `x.y.z` in a version or range, such as `^2.265.0`. */
function lowestVersion(range: string): Version | undefined {
  const parts = /(\d+)\.(\d+)\.(\d+)/.exec(range);
  return parts
    ? [Number(parts[1]), Number(parts[2]), Number(parts[3])]
    : undefined;
}

function isAtLeast(version: Version, minimum: Version): boolean {
  for (let part = 0; part < minimum.length; part++) {
    if (version[part] !== minimum[part]) {
      return version[part] > minimum[part];
    }
  }
  return true;
}

/** The oldest aws-cdk-lib the rewritten test is written for: the generator's own minimum. */
const MIN_CDK_LIB = lowestVersion(CDK_LIB_VERSION) as Version;

/**
 * Whether the workspace's root package.json asks for an aws-cdk-lib the
 * rewritten test runs on. An older one still writes the empty `Resources` key,
 * so its starter test passes and stays as it is.
 */
function hasCurrentCdkLib(tree: Tree): boolean {
  if (!tree.exists('package.json')) {
    return false;
  }
  const { dependencies = {}, devDependencies = {} } = readJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(tree, 'package.json');
  const declared = lowestVersion(
    dependencies['aws-cdk-lib'] ?? devDependencies['aws-cdk-lib'] ?? ''
  );
  return declared !== undefined && isAtLeast(declared, MIN_CDK_LIB);
}

/** The assertion that fails on current aws-cdk-lib while the stack is empty, normalised. */
const FAILING_ASSERTION = normalise('templateMatches({ Resources: {} })');

/** The names an untouched starter test carries. */
interface StarterNames {
  /** The describe block's name, where the starter test had one. */
  readonly describeName?: string;
  /** The stack id the test passes to `AppStack`, without its `TestStack` suffix. */
  readonly stackPrefix: string;
}

/**
 * Drops what a formatter may have changed in a generated file: whitespace,
 * quote style, semicolons and trailing commas.
 */
function normalise(source: string): string {
  return source
    .replace(/"/g, "'")
    .replace(/;/g, '')
    .replace(/,(\s*[)\]}])/g, '$1')
    .replace(/\s+/g, '');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A pattern that matches a normalised starter test and captures its names. */
function shapePattern(shape: string): RegExp {
  const pattern = escapeRegExp(normalise(shape))
    .replace(DESCRIBE_NAME, "(?<describeName>[^']*)")
    .replace(STACK_PREFIX, "(?<stackPrefix>[^']*)");
  return new RegExp(`^${pattern}$`);
}

const STARTER_PATTERNS = [
  shapePattern(DESCRIBE_SHAPE),
  shapePattern(LEGACY_SHAPE),
];

/** The names of an untouched starter test, or `undefined` for any other test. */
function matchStarter(source: string): StarterNames | undefined {
  const normalised = normalise(source);
  for (const pattern of STARTER_PATTERNS) {
    const groups = pattern.exec(normalised)?.groups;
    if (groups) {
      return {
        describeName: groups['describeName'],
        stackPrefix: groups['stackPrefix'],
      };
    }
  }
  return undefined;
}

function rewriteStarter(
  tree: Tree,
  projectRoot: string,
  projectName: string,
  starter: StarterNames
): void {
  generateFiles(tree, STARTER_TEMPLATE_DIR, projectRoot, {
    className: starter.describeName ?? names(projectName).className,
    projectName: starter.stackPrefix,
    template: '',
  });
}

const MANUAL_FIX =
  'assert expect(Template.fromStack(stack).toJSON().Resources ?? {}).toEqual({}) for an empty stack instead, and acknowledge ' +
  "'CloudFormation-Validate::F0001' with Validations.of(stack).acknowledge(...) to silence the empty-stack warning.";

function warnAboutEditedTest(testPath: string): void {
  logger.warn(
    `${testPath} asserts templateMatches({ Resources: {} }), which fails on aws-cdk-lib ${CDK_LIB_VERSION} ` +
      'while the stack is still empty: an empty stack has no Resources key. The migration leaves edited tests alone; ' +
      MANUAL_FIX
  );
}

function warnAboutOldCdkLib(testPath: string): void {
  logger.warn(
    `${testPath} is the old starter test, left as it is: the workspace's package.json asks for no aws-cdk-lib ` +
      `${CDK_LIB_VERSION}, which the new test is written for. Once you update aws-cdk-lib, ` +
      MANUAL_FIX
  );
}

/**
 * Rewrites the starter `src/main.test.ts` of apps generated before 4.1.3, which
 * fails on current aws-cdk-lib, to the test the generator writes now. Only a
 * test that is still exactly the generated one is rewritten, and only where the
 * workspace asks for the aws-cdk-lib the new test is written for; an edited test
 * that still holds the failing assertion is named in a warning.
 */
export default async function updateStarterTest(tree: Tree): Promise<void> {
  const canRewrite = hasCurrentCdkLib(tree);
  let rewritten = false;
  for (const [projectName, project] of getProjects(tree)) {
    const testPath = joinPathFragments(project.root, STARTER_TEST);
    const source = tree.read(testPath, 'utf-8');
    if (source === null) {
      continue;
    }
    const starter = matchStarter(source);
    if (starter && !canRewrite) {
      warnAboutOldCdkLib(testPath);
    } else if (starter) {
      rewriteStarter(tree, project.root, projectName, starter);
      rewritten = true;
    } else if (normalise(source).includes(FAILING_ASSERTION)) {
      warnAboutEditedTest(testPath);
    }
  }
  if (rewritten) {
    await formatFiles(tree);
  }
}
