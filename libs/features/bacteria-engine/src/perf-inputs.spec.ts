/**
 * @jest-environment node
 */
import { build, type BuildOptions } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join, matchesGlob, relative, sep } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..');
const WORKSPACE_ROOT = join(PROJECT_ROOT, '../../..');
/** One esbuild bundle of the whole main entry, under parallel Jest load. */
const BUNDLE_TIMEOUT_MS = 60_000;

/**
 * What `tools/perf/engine-bench.mjs` plays (`engine-bench.json`): the entry
 * and the options it bundles it with, the files its result depends on
 * beside the bundle (`reads`), and the fixtures it times.
 */
interface BenchPlan {
  entry: string;
  build: Pick<BuildOptions, 'bundle' | 'platform' | 'format'>;
  reads: string[];
  fixtures: { name: string; file: string; gpuInt?: boolean }[];
}

type TargetInput = string | { fileset?: string };

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function workspacePath(file: string): string {
  return relative(WORKSPACE_ROOT, file).split(sep).join('/');
}

const BENCH_PLAN = readJson<BenchPlan>(
  join(WORKSPACE_ROOT, 'tools/perf/engine-bench.json')
);
const perfInputs = readJson<{
  targets: { perf: { inputs: TargetInput[] } };
}>(join(PROJECT_ROOT, 'project.json')).targets.perf.inputs;

/**
 * The `perf` target's file patterns, relative to the workspace root, split
 * into the ones that add files and the negated ones that take them out
 * again. Named inputs (`^production`) name no file of this project.
 */
function filePatterns(): { include: string[]; exclude: string[] } {
  const projectRoot = workspacePath(PROJECT_ROOT);
  const patterns = perfInputs
    .map((input) => (typeof input === 'string' ? input : input.fileset))
    .filter((input): input is string =>
      /^!?\{(projectRoot|workspaceRoot)\}\//.test(input ?? '')
    )
    .map((input) =>
      input
        .replace('{projectRoot}', projectRoot)
        .replace('{workspaceRoot}/', '')
    );
  return {
    include: patterns.filter((pattern) => !pattern.startsWith('!')),
    exclude: patterns
      .filter((pattern) => pattern.startsWith('!'))
      .map((pattern) => pattern.slice(1)),
  };
}

/** The files of `files` the `perf` target does not hash. */
function missingFromInputs(files: string[]): string[] {
  const { include, exclude } = filePatterns();
  return files.filter(
    (file) =>
      !include.some((pattern) => matchesGlob(file, pattern)) ||
      exclude.some((pattern) => matchesGlob(file, pattern))
  );
}

describe('the perf target', () => {
  it(
    'hashes every file the engine bench bundles',
    async () => {
      const result = await build({
        ...BENCH_PLAN.build,
        absWorkingDir: WORKSPACE_ROOT,
        entryPoints: [BENCH_PLAN.entry],
        metafile: true,
        write: false,
        logLevel: 'silent',
      });

      const bundled = Object.keys(result.metafile.inputs);
      expect(bundled).toContain(BENCH_PLAN.entry);
      expect(missingFromInputs(bundled)).toEqual([]);
    },
    BUNDLE_TIMEOUT_MS
  );

  it('bundles with no esbuild option that could read a file of its own', () => {
    // `tsconfig`, `alias`, `inject` and the like would make esbuild read
    // files neither the bundle's metafile nor `reads` names.
    expect(BENCH_PLAN.build).toEqual({
      bundle: true,
      platform: 'node',
      format: 'esm',
    });
  });

  it('hashes the bench, its baseline, what its result depends on beside the bundle and every fixture', () => {
    const benchFiles = [
      'tools/perf/engine-bench.mjs',
      'tools/perf/engine-bench.json',
      'tools/perf/engine-baseline.json',
      ...BENCH_PLAN.reads,
      ...BENCH_PLAN.fixtures.map((fixture) => fixture.file),
    ];

    expect(missingFromInputs(benchFiles)).toEqual([]);
  });
});
