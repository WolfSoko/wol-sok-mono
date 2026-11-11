// Keeps the release from deploying apps whose deploy task reads none of the
// changed files (#2888): Nx counts every target's inputs as affecting, so a
// lint-only root config (`.oxlintrc.json`, `eslint.config.mjs`) made every
// app affected.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  isVersionBumpOnly,
  keepsNxVerdict,
  selectReleaseAffected,
  tsconfigBaseChanges,
} from './release-affected.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const SCRIPT = join(import.meta.dirname, 'release-affected.mjs');

const INPUTS = {
  pacetrainer: ['apps/pacetrainer/src/main.ts', 'firebase.pacetrainer.json'],
  korbjaeger: ['apps/korbjaeger/src/main.ts', 'libs/shared/legal/index.ts'],
  portfolio: ['apps/portfolio/src/main.ts', 'libs/shared/legal/index.ts'],
};

function select(changedFiles, deletedFiles = []) {
  return selectReleaseAffected({
    candidates: Object.keys(INPUTS),
    changedFiles,
    deletedFiles,
    inputsOf: (project) => new Set(INPUTS[project]),
  }).selected;
}

describe('selectReleaseAffected', () => {
  it('drops every candidate when no changed file is an input', () => {
    assert.deepEqual(select(['.oxlintrc.json', 'eslint.config.mjs']), []);
  });

  it('keeps only the candidates reading a changed file', () => {
    assert.deepEqual(select(['firebase.pacetrainer.json']), ['pacetrainer']);
    assert.deepEqual(select(['libs/shared/legal/index.ts']), [
      'korbjaeger',
      'portfolio',
    ]);
  });

  // No candidate's inputs list these files: the rule, not Nx's hashing,
  // keeps them.
  it("keeps Nx's verdict for the root files it cannot judge", () => {
    for (const file of [
      'package.json',
      'package-lock.json',
      'nx.json',
      'tsconfig.cdk.json',
      'tsconfig.base.json',
    ]) {
      assert.deepEqual(select([file]), Object.keys(INPUTS), file);
    }
  });

  it("keeps a candidate whose inputs could not be read, with Nx's verdict", () => {
    const { selected, reasons } = selectReleaseAffected({
      candidates: ['pacetrainer', 'korbjaeger'],
      changedFiles: ['firebase.pacetrainer.json'],
      deletedFiles: [],
      inputsOf: (project) =>
        project === 'korbjaeger' ? undefined : new Set(INPUTS[project]),
    });
    assert.deepEqual(selected, ['pacetrainer', 'korbjaeger']);
    assert.deepEqual(reasons, {
      pacetrainer: 'reads firebase.pacetrainer.json',
      korbjaeger: "Nx's verdict: its inputs could not be read",
    });
  });

  it("keeps Nx's verdict for a deleted file, which no input set lists", () => {
    assert.deepEqual(
      select([], ['apps/pacetrainer/src/old.ts']),
      Object.keys(INPUTS)
    );
  });

  it('selects nothing without candidates', () => {
    const { selected } = selectReleaseAffected({
      candidates: [],
      changedFiles: ['apps/pacetrainer/src/main.ts'],
      deletedFiles: [],
      inputsOf: () => {
        throw new Error('no candidate to read');
      },
    });
    assert.deepEqual(selected, []);
  });

  it('says why each candidate was kept or dropped', () => {
    const { reasons } = selectReleaseAffected({
      candidates: ['pacetrainer', 'korbjaeger'],
      changedFiles: ['firebase.pacetrainer.json', '.oxlintrc.json'],
      deletedFiles: [],
      inputsOf: (project) => new Set(INPUTS[project]),
    });
    assert.deepEqual(reasons, {
      pacetrainer: 'reads firebase.pacetrainer.json',
      korbjaeger: 'reads none of the changed files',
    });
  });
});

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    paths: { '@wolsok/a': ['./libs/a/src/index.ts'] },
  },
};

function withPaths(paths, target = 'ES2022') {
  return { compilerOptions: { target, paths } };
}

describe('tsconfigBaseChanges', () => {
  it('counts a new alias as the files it points to', () => {
    const after = withPaths({
      '@wolsok/a': ['./libs/a/src/index.ts'],
      '@wolsok/b': ['./libs/b/src/index.ts'],
    });
    assert.deepEqual(tsconfigBaseChanges(TSCONFIG, after), [
      'libs/b/src/index.ts',
    ]);
  });

  it('counts a retargeted or removed alias by its old and new files', () => {
    const retargeted = withPaths({ '@wolsok/a': ['./libs/a/src/main.ts'] });
    assert.deepEqual(tsconfigBaseChanges(TSCONFIG, retargeted), [
      'libs/a/src/index.ts',
      'libs/a/src/main.ts',
    ]);
    assert.deepEqual(tsconfigBaseChanges(TSCONFIG, withPaths({})), [
      'libs/a/src/index.ts',
    ]);
  });

  // A wildcard target matches no input file literally, so the change counts
  // as the base itself, which keeps Nx's verdict.
  it('counts a changed wildcard alias or target as the file itself', () => {
    const withWildcard = withPaths({
      ...TSCONFIG.compilerOptions.paths,
      '@wolsok/*': ['./libs/*/src/index.ts'],
    });
    const cases = {
      'wildcard alias added': [TSCONFIG, withWildcard],
      'wildcard alias removed': [withWildcard, TSCONFIG],
      'wildcard alias retargeted': [
        withWildcard,
        withPaths({
          ...TSCONFIG.compilerOptions.paths,
          '@wolsok/*': ['./libs/*/index.ts'],
        }),
      ],
      'literal alias retargeted to a wildcard': [
        TSCONFIG,
        withPaths({ '@wolsok/a': ['./libs/a/src/*'] }),
      ],
    };
    for (const [name, [before, after]] of Object.entries(cases)) {
      assert.deepEqual(
        tsconfigBaseChanges(before, after),
        ['tsconfig.base.json'],
        name
      );
    }
  });

  it('counts any other change as the file itself', () => {
    const retarget = withPaths(TSCONFIG.compilerOptions.paths, 'ES2024');
    assert.deepEqual(tsconfigBaseChanges(TSCONFIG, retarget), [
      'tsconfig.base.json',
    ]);
  });
});

describe('keepsNxVerdict', () => {
  it('holds for the npm files, nx.json and the root tsconfigs', () => {
    for (const file of [
      'package.json',
      'package-lock.json',
      'nx.json',
      'tsconfig.base.json',
      'tsconfig.cdk.json',
    ]) {
      assert.equal(keepsNxVerdict(file), true, file);
    }
    for (const file of [
      'apps/x/tsconfig.json',
      'apps/x/nx.json',
      'apps/x/package.json',
      '.oxlintrc.json',
    ]) {
      assert.equal(keepsNxVerdict(file), false, file);
    }
  });
});

describe('isVersionBumpOnly', () => {
  const before = { name: '@wolsok/thanos', version: '1.0.0', dependencies: {} };

  it('holds for a change of the version alone', () => {
    assert.equal(
      isVersionBumpOnly(before, { ...before, version: '1.0.1' }),
      true
    );
  });

  it('fails for any other change', () => {
    const withDependency = {
      ...before,
      version: '1.0.1',
      dependencies: { tslib: '^2.3.0' },
    };
    assert.equal(isVersionBumpOnly(before, withDependency), false);
    assert.equal(isVersionBumpOnly(before, { ...before }), false);
  });
});

function runScript(...args) {
  return execFileSync('node', [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\n')
    .filter((line) => line !== '');
}

const NON_CDK = '--exclude=tag:cdk,tag:published,tag:type:android';

describe('release-affected on the workspace', () => {
  for (const file of ['.oxlintrc.json', 'eslint.config.mjs']) {
    it(`deploys and publishes nothing for ${file}`, () => {
      assert.deepEqual(runScript(`--files=${file}`, '--target=deploy'), []);
      assert.deepEqual(
        runScript(
          `--files=${file}`,
          '--target=build',
          '--projects=tag:published'
        ),
        []
      );
    });
  }

  it('deploys an app whose root Firebase config changed', () => {
    assert.deepEqual(
      runScript(
        '--files=firebase.pacetrainer.json',
        '--target=deploy',
        NON_CDK
      ),
      ['pacetrainer']
    );
  });

  // .browserslistrc is an input of korbjaeger:build-app, which deploy runs
  // through build: inputs of the tasks a deploy depends on count too.
  it('deploys an app whose build step reads the changed file', () => {
    assert.ok(
      runScript('--files=.browserslistrc', '--target=deploy', NON_CDK).includes(
        'korbjaeger'
      )
    );
  });

  it('deploys an app whose own source changed, and only it', () => {
    assert.deepEqual(
      runScript(
        '--files=apps/pacetrainer/src/main.ts',
        '--target=deploy',
        NON_CDK
      ),
      ['pacetrainer']
    );
  });
});

function stepsOf(workflow) {
  return readFileSync(join(ROOT, '.github', 'workflows', workflow), 'utf8')
    .split(/\n(?=\s+- (?:name|uses|run):)/)
    .slice(1);
}

describe('deploy.yml', () => {
  const steps = stepsOf('deploy.yml');

  it('releases exactly the selected projects, never through nx affected', () => {
    const releasing = steps.filter((step) =>
      /nx (run-many|release publish)/.test(step)
    );
    assert.equal(releasing.length, 3);
    for (const step of releasing) {
      assert.match(step, /--projects="\$RELEASE_PROJECTS"/);
    }
    assert.ok(steps.every((step) => !/nx affected/.test(step)));
  });

  // Without pipefail, a pipe would turn a failing selection into an empty one.
  it('never pipes the selection, which would hide its failure', () => {
    const piped = steps.filter((step) =>
      /release-affected\.mjs[^\n]*\|/.test(step)
    );
    assert.deepEqual(piped, []);
  });

  // An empty --projects can mean every project; such a leg skips instead.
  it('skips every releasing step when the selection is empty', () => {
    const unguarded = steps
      .filter((step) => step.includes('--projects="$RELEASE_PROJECTS"'))
      .filter((step) => !step.includes("env.RELEASE_PROJECTS != ''"));
    assert.deepEqual(unguarded, []);
  });
});
