/**
 * @jest-environment node
 */
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';

const CLOUD_FOLDER = ['lib', 'state', 'cloud', ''].join(sep);
const SIMULATION = ['lib', 'state', 'simulation', ''].join(sep);
/** The GPU mirror of the simulation, the `/gpu` entry's paths. */
const GPU_PATHS = [
  `${SIMULATION}gpu-int${sep}`,
  `${SIMULATION}grid${sep}`,
  `${SIMULATION}grid-format.ts`,
];

/** Where each name an entry exports is declared, relative to `src/`. */
function declaredFiles(entry: string): Map<string, string[]> {
  const file = join(__dirname, entry);
  const program = ts.createProgram([file], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const entrySymbol = source && checker.getSymbolAtLocation(source);
  if (!entrySymbol) {
    throw new Error(`${entry} has no exports`);
  }
  return new Map(
    checker.getExportsOfModule(entrySymbol).map((symbol) => {
      const target =
        symbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol;
      const files = (target.declarations ?? []).map((declaration) =>
        relative(__dirname, declaration.getSourceFile().fileName)
      );
      // An import that does not resolve leaves a name without declarations,
      // which would count as neither side and pass unchecked.
      if (files.length === 0) {
        throw new Error(`${entry}: ${symbol.name} has no declaration`);
      }
      return [symbol.name, files];
    })
  );
}

function namesDeclared(
  exports: Map<string, string[]>,
  where: (file: string) => boolean
): string[] {
  return [...exports]
    .filter(([, files]) => files.some(where))
    .map(([name]) => name);
}

const inCloud = (file: string) => file.startsWith(CLOUD_FOLDER);
const inGpu = (file: string) => GPU_PATHS.some((path) => file.startsWith(path));

describe('engine entries', () => {
  it('the main entry exports nothing of the cloud contract', () => {
    expect(namesDeclared(declaredFiles('index.ts'), inCloud)).toEqual([]);
  });

  it('the main entry exports nothing of the GPU mirror', () => {
    expect(namesDeclared(declaredFiles('index.ts'), inGpu)).toEqual([]);
  });

  it('the /cloud entry exports only the cloud contract', () => {
    const cloud = declaredFiles('cloud.ts');

    expect(cloud.size).toBeGreaterThan(0);
    expect(namesDeclared(cloud, (file) => !inCloud(file))).toEqual([]);
  });

  it('the /gpu entry exports only the GPU mirror', () => {
    const gpu = declaredFiles('gpu.ts');

    expect(gpu.size).toBeGreaterThan(0);
    expect(namesDeclared(gpu, (file) => !inGpu(file))).toEqual([]);
  });
});
