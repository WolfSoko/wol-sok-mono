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
const NODE_MODULE_KINDS = ['Node16', 'Node18', 'Node20', 'NodeNext'];
const NODE_RESOLUTION_KINDS = ['Node16', 'NodeNext'];

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function buildCompilerOptions(): ts.CompilerOptions {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    BUILD_TSCONFIG,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(formatDiagnostic(diagnostic));
      },
    }
  );
  if (!parsed) {
    throw new Error(`Cannot read ${BUILD_TSCONFIG}`);
  }
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(formatDiagnostic).join('\n'));
  }
  return parsed.options;
}

describe('the published package format', () => {
  const options = buildCompilerOptions();

  it('is built with a Node module kind, so Node loads what tsc emits', () => {
    const moduleKind =
      options.module === undefined ? 'default' : ts.ModuleKind[options.module];

    expect(NODE_MODULE_KINDS).toContain(moduleKind);
  });

  it('resolves modules as Node does, so NodeNext consumers find its types', () => {
    const resolutionKind =
      options.moduleResolution === undefined
        ? 'default'
        : ts.ModuleResolutionKind[options.moduleResolution];

    expect(NODE_RESOLUTION_KINDS).toContain(resolutionKind);
  });
});
