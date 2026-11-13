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
  ownerRoot,
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

const ROOTS = {
  wolsok: '.',
  pacetrainer: 'apps/pacetrainer',
  korbjaeger: 'apps/korbjaeger',
  portfolio: 'apps/portfolio',
  'shared-legal': 'libs/shared/legal',
};

function select(changedFiles, deletedFiles = []) {
  return selectReleaseAffected({
    candidates: Object.keys(INPUTS),
    changedFiles,
    deletedFiles,
    inputsOf: (project) => new Set(INPUTS[project]),
    projectRoots: ROOTS,
  }).selected;
}

void describe('selectReleaseAffected', () => {
  void it('drops every candidate when no changed file is an input', () => {
    assert.deepEqual(select(['.oxlintrc.json', 'eslint.config.mjs']), []);
  });

  void it('keeps only the candidates reading a changed file', () => {
    assert.deepEqual(select(['firebase.pacetrainer.json']), ['pacetrainer']);
    assert.deepEqual(select(['libs/shared/legal/index.ts']), [
      'korbjaeger',
      'portfolio',
    ]);
  });

  // No candidate's inputs list these files: the rule, not Nx's hashing,
  // keeps them.
  void it("keeps Nx's verdict for the root files it cannot judge", () => {
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

  void it("keeps a candidate whose inputs could not be read, with Nx's verdict", () => {
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

  void it("keeps Nx's verdict for a file deleted outside every project", () => {
    for (const file of ['firebase.old.json', 'docs/old.md']) {
      assert.deepEqual(select([], [file]), Object.keys(INPUTS), file);
    }
  });

  // Its files would fall to an enclosing root its readers need not read.
  void it("keeps Nx's verdict for a deleted project.json", () => {
    assert.deepEqual(
      select([], ['apps/pacetrainer/project.json']),
      Object.keys(INPUTS)
    );
  });

  void it('counts a file deleted in a project only for the candidates reading its files', () => {
    assert.deepEqual(select([], ['apps/pacetrainer/src/old.ts']), [
      'pacetrainer',
    ]);
    assert.deepEqual(
      select(['firebase.pacetrainer.json'], ['apps/portfolio/src/old.ts']),
      ['pacetrainer', 'portfolio']
    );
  });

  // The filter only drops a candidate reading nothing of the owner: one
  // importing from it reads the owner's files, so it stays.
  void it("keeps every dependent of the deleted file's project", () => {
    assert.deepEqual(select([], ['libs/shared/legal/src/old.ts']), [
      'korbjaeger',
      'portfolio',
    ]);
  });

  void it("keeps Nx's verdict where the project roots could not be read", () => {
    const { selected } = selectReleaseAffected({
      candidates: Object.keys(INPUTS),
      changedFiles: [],
      deletedFiles: ['apps/pacetrainer/src/old.ts'],
      inputsOf: (project) => new Set(INPUTS[project]),
      projectRoots: undefined,
    });
    assert.deepEqual(selected, Object.keys(INPUTS));
  });

  void it('says which deletion a candidate was kept for', () => {
    const { reasons } = selectReleaseAffected({
      candidates: ['korbjaeger', 'pacetrainer'],
      changedFiles: [],
      deletedFiles: ['libs/shared/legal/src/old.ts'],
      inputsOf: (project) => new Set(INPUTS[project]),
      projectRoots: ROOTS,
    });
    assert.deepEqual(reasons, {
      korbjaeger:
        'reads libs/shared/legal/, where libs/shared/legal/src/old.ts was deleted',
      pacetrainer: 'reads none of the changed files',
    });
  });

  void it('selects nothing without candidates', () => {
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

  void it('says why each candidate was kept or dropped', () => {
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

void describe('ownerRoot', () => {
  const roots = ['.', 'tools', 'tools/federation', 'libs/a'];

  void it('takes the longest root holding the file', () => {
    assert.equal(ownerRoot('tools/federation/x.js', roots), 'tools/federation');
    assert.equal(ownerRoot('tools/ci/x.mjs', roots), 'tools');
    assert.equal(ownerRoot('libs/a/src/x.ts', roots), 'libs/a');
  });

  // The root project would own every file.
  void it('finds none for a file outside every project but the root one', () => {
    assert.equal(ownerRoot('package.json', roots), undefined);
    assert.equal(ownerRoot('docs/x.md', roots), undefined);
  });

  void it('matches a root only up to a slash', () => {
    assert.equal(ownerRoot('libs/ab/x.ts', roots), undefined);
    assert.equal(ownerRoot('libs/a', roots), undefined);
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

void describe('tsconfigBaseChanges', () => {
  void it('counts a new alias as the files it points to', () => {
    const after = withPaths({
      '@wolsok/a': ['./libs/a/src/index.ts'],
      '@wolsok/b': ['./libs/b/src/index.ts'],
    });
    assert.deepEqual(tsconfigBaseChanges(TSCONFIG, after), [
      'libs/b/src/index.ts',
    ]);
  });

  void it('counts a retargeted or removed alias by its old and new files', () => {
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
  void it('counts a changed wildcard alias or target as the file itself', () => {
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

  void it('counts any other change as the file itself', () => {
    const retarget = withPaths(TSCONFIG.compilerOptions.paths, 'ES2024');
    assert.deepEqual(tsconfigBaseChanges(TSCONFIG, retarget), [
      'tsconfig.base.json',
    ]);
  });
});

void describe('keepsNxVerdict', () => {
  void it('holds for the npm files, nx.json and the root tsconfigs', () => {
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

void describe('isVersionBumpOnly', () => {
  const before = { name: '@wolsok/thanos', version: '1.0.0', dependencies: {} };

  void it('holds for a change of the version alone', () => {
    assert.equal(
      isVersionBumpOnly(before, { ...before, version: '1.0.1' }),
      true
    );
  });

  void it('fails for any other change', () => {
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

void describe('release-affected on the workspace', () => {
  for (const file of ['.oxlintrc.json', 'eslint.config.mjs']) {
    void it(`deploys and publishes nothing for ${file}`, () => {
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

  void it('deploys an app whose root Firebase config changed', () => {
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
  void it('deploys an app whose build step reads the changed file', () => {
    assert.ok(
      runScript('--files=.browserslistrc', '--target=deploy', NON_CDK).includes(
        'korbjaeger'
      )
    );
  });

  // A path missing at the head counts as deleted.
  void it('deploys only the app a file was deleted from', () => {
    assert.deepEqual(
      runScript(
        '--files=apps/pacetrainer/src/deleted-by-3054.ts',
        '--target=deploy',
        NON_CDK
      ),
      ['pacetrainer']
    );
  });

  // #3029's deletion beside a lint-only change kept all three packages.
  void it('versions only the package a file was deleted from', () => {
    assert.deepEqual(
      runScript(
        '--files=libs/public/nx-aws-cdk-v2/src/utils/testing.ts,.oxlintrc.json',
        '--target=build',
        '--projects=tag:published'
      ),
      ['nx-aws-cdk-v2']
    );
  });

  void it('deploys an app whose own source changed, and only it', () => {
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

void describe('deploy.yml', () => {
  const steps = stepsOf('deploy.yml');

  void it('releases exactly the selected projects, never through nx affected', () => {
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
  void it('never pipes the selection, which would hide its failure', () => {
    const piped = steps.filter((step) =>
      /release-affected\.mjs[^\n]*\|/.test(step)
    );
    assert.deepEqual(piped, []);
  });

  // An empty --projects can mean every project; such a leg skips instead.
  void it('skips every releasing step when the selection is empty', () => {
    const unguarded = steps
      .filter((step) => step.includes('--projects="$RELEASE_PROJECTS"'))
      .filter((step) => !step.includes("env.RELEASE_PROJECTS != ''"));
    assert.deepEqual(unguarded, []);
  });
});

// nx release counts every target's inputs too, so on its own it bumped, and
// the npm leg published, every package on a lint-only commit (#3020).
void describe('release.yml', () => {
  const version = stepsOf('release.yml').find((step) =>
    step.includes('name: Version')
  );

  void it('versions only the packages whose build reads a change of this release', () => {
    assert.match(
      version,
      /release-affected\.mjs --base="v\$\(node -p "require\('\.\/version\.json'\)\.version"\)" --head=HEAD --target=build --projects='tag:published'/
    );
    assert.match(version, /npx nx release version --projects="\$packages"/);
    assert.doesNotMatch(version, /npx nx release version\s*\n/);
  });

  // Up to the substitution's end, so a pipe on a continuation line counts.
  void it('never pipes the selection, which would hide its failure', () => {
    assert.doesNotMatch(version, /release-affected\.mjs[^)]*\|/);
    assert.match(version, /packages=\$\(paste -sd, - <<< "\$selected"\)/);
  });

  // An empty --projects can mean every package.
  void it('skips nx release version when the selection is empty', () => {
    assert.match(
      version,
      /if \[\[ -n "\$packages" \]\]; then\s+npx nx release version --projects="\$packages"/
    );
  });
});
