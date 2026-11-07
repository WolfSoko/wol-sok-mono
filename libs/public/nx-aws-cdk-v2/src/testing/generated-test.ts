import { Tree } from '@nx/devkit';
import { posix } from 'node:path';
import { runInThisContext } from 'node:vm';
import * as ts from 'typescript';

/** A test body a generated spec registered with `it` or `test`. */
export interface GeneratedTest {
  readonly name: string;
  readonly run: () => unknown;
}

/** What running the generated tests of a file reported. */
export interface GeneratedTestRun {
  /** The names of the tests that ran. */
  readonly names: readonly string[];
  /** Everything the tests wrote to `console.log`, `warn` and `error`. */
  readonly logged: string;
}

/** Where aws-cdk-lib may print its validation report. */
const CAPTURED_CONSOLE_METHODS = ['log', 'warn', 'error'] as const;

/** The test globals a generated spec may use. */
interface TestGlobals {
  readonly describe: (name: string, body: () => void) => void;
  readonly it: (name: string, run: () => unknown) => void;
  readonly test: (name: string, run: () => unknown) => void;
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
    throw new Error(`The tree holds no ${path}`);
  }
  const moduleRecord = { exports: {} as Record<string, unknown> };
  const requireModule = (id: string): unknown =>
    id.startsWith('.')
      ? loadFromTree(tree, `${posix.join(posix.dirname(path), id)}.ts`)
      : require(id);
  const factory: (...args: unknown[]) => void = runInThisContext(
    `(function (require, module, exports, describe, it, test, expect) {\n${transpile(source)}\n})`
  );
  factory(
    requireModule,
    moduleRecord,
    moduleRecord.exports,
    globals?.describe,
    globals?.it,
    globals?.test,
    globals?.expect
  );
  return moduleRecord.exports;
}

/** Loads a generated test file from the tree and returns the tests it registers. */
export function collectGeneratedTests(
  tree: Tree,
  testPath: string
): GeneratedTest[] {
  const tests: GeneratedTest[] = [];
  const register = (name: string, run: () => unknown): void => {
    tests.push({ name, run });
  };
  loadFromTree(tree, testPath, {
    describe: (_name, body) => body(),
    it: register,
    test: register,
    expect,
  });
  return tests;
}

/**
 * Runs every test of a generated test file against the workspace's packages,
 * one after the other, and captures what they log, loading included. Throws on the first failing
 * test, naming it.
 */
export async function runGeneratedTests(
  tree: Tree,
  testPath: string
): Promise<GeneratedTestRun> {
  const consoleSpies = CAPTURED_CONSOLE_METHODS.map((method) =>
    jest.spyOn(console, method).mockImplementation(() => undefined)
  );
  try {
    const tests = collectGeneratedTests(tree, testPath);
    for (const test of tests) {
      await runNamed(test);
    }
    const logged = consoleSpies
      .flatMap((spy) => spy.mock.calls)
      .flat()
      .join('\n');
    return { names: tests.map((test) => test.name), logged };
  } finally {
    consoleSpies.forEach((spy) => spy.mockRestore());
  }
}
