import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { posix } from 'node:path';
import { runInThisContext } from 'node:vm';
import * as ts from 'typescript';

import generator from './application';

/** A test body the generated spec registered with `it`. */
interface GeneratedTest {
  readonly name: string;
  readonly run: () => unknown;
}

/** Where aws-cdk-lib may print its validation report. */
const CAPTURED_CONSOLE_METHODS = ['log', 'warn', 'error'] as const;

/** The test globals the generated spec uses. */
interface TestGlobals {
  readonly describe: (name: string, body: () => void) => void;
  readonly it: (name: string, run: () => unknown) => void;
  readonly expect: typeof expect;
}

/** Runs a generated test and names it in the failure. */
async function runNamed(test: GeneratedTest): Promise<void> {
  try {
    await test.run();
  } catch (failure) {
    throw new Error(`Generated test "${test.name}" failed`, { cause: failure });
  }
}

function transpile(source: string): string {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

/**
 * Loads a generated TypeScript module from the tree as CommonJS. Its relative
 * imports load from the tree the same way; everything else comes from the
 * workspace, aws-cdk-lib included.
 */
function loadFromTree(
  tree: Tree,
  path: string,
  globals?: TestGlobals
): Record<string, unknown> {
  const source = tree.read(path, 'utf-8');
  if (source === null) {
    throw new Error(`The generator wrote no ${path}`);
  }
  const moduleRecord = { exports: {} as Record<string, unknown> };
  const requireModule = (id: string): unknown =>
    id.startsWith('.')
      ? loadFromTree(tree, `${posix.join(posix.dirname(path), id)}.ts`)
      : require(id);
  const factory: (...args: unknown[]) => void = runInThisContext(
    `(function (require, module, exports, describe, it, expect) {\n${transpile(source)}\n})`
  );
  factory(
    requireModule,
    moduleRecord,
    moduleRecord.exports,
    globals?.describe,
    globals?.it,
    globals?.expect
  );
  return moduleRecord.exports;
}

/** Loads the generated `main.test.ts` and returns the tests it registers. */
function collectGeneratedTests(tree: Tree, testPath: string): GeneratedTest[] {
  const tests: GeneratedTest[] = [];
  loadFromTree(tree, testPath, {
    describe: (_name, body) => body(),
    it: (name, run) => tests.push({ name, run }),
    expect,
  });
  return tests;
}

describe('generated main.test.ts', () => {
  let tests: GeneratedTest[];

  beforeAll(async () => {
    const tree = createTreeWithEmptyWorkspace();
    await generator(tree, { name: 'starter', skipFormat: true });
    tests = collectGeneratedTests(tree, 'starter/src/main.test.ts');
  });

  it('registers at least one test', () => {
    expect(tests.length).toBeGreaterThan(0);
  });

  it('passes against the workspace aws-cdk-lib without validation warnings', async () => {
    const consoleSpies = CAPTURED_CONSOLE_METHODS.map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined)
    );
    try {
      for (const test of tests) {
        await runNamed(test);
      }
      const logged = consoleSpies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .join('\n');
      expect(logged).not.toContain('CloudFormation-Validate');
    } finally {
      consoleSpies.forEach((spy) => spy.mockRestore());
    }
  });
});
