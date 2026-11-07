import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { runInThisContext } from 'node:vm';
import * as ts from 'typescript';

import generator from './application';

/** A test body the generated spec registered with `it`. */
interface GeneratedTest {
  readonly name: string;
  readonly run: () => unknown;
}

const APP_STACK_IMPORT = './stacks/app-stack';

/** Where aws-cdk-lib may print its validation report. */
const CAPTURED_CONSOLE_METHODS = ['log', 'warn', 'error'] as const;

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
 * Evaluates a transpiled CommonJS module. `localModules` stands in for the
 * app's own relative imports; everything else comes from the workspace.
 */
function evaluate(
  code: string,
  localModules: Record<string, unknown>,
  globals: Record<string, unknown> = {}
): Record<string, unknown> {
  const moduleRecord = { exports: {} as Record<string, unknown> };
  const requireModule = (id: string): unknown =>
    id in localModules ? localModules[id] : require(id);
  const globalNames = Object.keys(globals);
  const factory: (...args: unknown[]) => void = runInThisContext(
    `(function (require, module, exports, ${globalNames.join(', ')}) {\n${code}\n})`
  );
  factory(
    requireModule,
    moduleRecord,
    moduleRecord.exports,
    ...globalNames.map((name) => globals[name])
  );
  return moduleRecord.exports;
}

/**
 * Loads the generated `main.test.ts` against the generated app stack and the
 * workspace's aws-cdk-lib, and returns the tests it registers.
 */
function collectGeneratedTests(
  tree: Tree,
  sourceRoot: string
): GeneratedTest[] {
  const read = (path: string): string => {
    const content = tree.read(`${sourceRoot}/${path}`, 'utf-8');
    if (content === null) {
      throw new Error(`The generator wrote no ${sourceRoot}/${path}`);
    }
    return content;
  };
  const appStack = evaluate(transpile(read('stacks/app-stack.ts')), {});
  const tests: GeneratedTest[] = [];
  evaluate(
    transpile(read('main.test.ts')),
    { [APP_STACK_IMPORT]: appStack },
    {
      describe: (_name: string, body: () => void) => body(),
      it: (name: string, run: () => unknown) => tests.push({ name, run }),
      expect,
    }
  );
  return tests;
}

describe('generated main.test.ts', () => {
  let tests: GeneratedTest[];

  beforeAll(async () => {
    const tree = createTreeWithEmptyWorkspace();
    await generator(tree, { name: 'starter', skipFormat: true });
    tests = collectGeneratedTests(tree, 'starter/src');
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
