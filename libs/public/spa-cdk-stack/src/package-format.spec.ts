import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const BUILD_TSCONFIG = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'tsconfig.lib.json'
);

/**
 * Module settings under which `tsc` resolves relative imports the way Node
 * does: it emits CommonJS for a package without `"type": "module"` and refuses
 * an ES module output with extensionless relative imports (#3100).
 */
const NODE_MODULE_KINDS = [ts.ModuleKind.Node16, ts.ModuleKind.NodeNext];
const NODE_RESOLUTION_KINDS = [
  ts.ModuleResolutionKind.Node16,
  ts.ModuleResolutionKind.NodeNext,
];

function buildCompilerOptions(): ts.CompilerOptions {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    BUILD_TSCONFIG,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        );
      },
    }
  );
  if (!parsed) {
    throw new Error(`Cannot read ${BUILD_TSCONFIG}`);
  }
  return parsed.options;
}

describe('the published package format', () => {
  const options = buildCompilerOptions();

  it('is built with a Node module kind, so Node loads what tsc emits', () => {
    expect(NODE_MODULE_KINDS).toContain(options.module);
  });

  it('resolves modules as Node does, so NodeNext consumers find its types', () => {
    expect(NODE_RESOLUTION_KINDS).toContain(options.moduleResolution);
  });
});
