// Keeps the manual redeploy of deploy.yml (#3058): a dispatch can skip the
// Nx cache and name the projects to deploy, the call from release.yml stays
// as it was, and every deploy's output reaches the log. Plain text checks:
// the workspace declares no YAML parser.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { missingProjects, requestedProjects } from './deploy-override.mjs';

const ROOT = join(dirname(import.meta.filename), '../..');
const SCRIPT = join(ROOT, 'tools/ci/deploy-override.mjs');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const DEPLOY = read('.github/workflows/deploy.yml');
const RELEASE = read('.github/workflows/release.yml');

/** The block below `key:` up to the next line indented as far or less. */
function blockOf(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  assert.notEqual(start, -1, `no ${key}: block`);
  const indent = lines[start].search(/\S/);
  const end = lines.findIndex(
    (line, i) => i > start && line.trim() !== '' && line.search(/\S/) <= indent
  );
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

/** Each matrix leg's app type and exclude pattern. */
function legs() {
  return [
    ...DEPLOY.matchAll(/- app-type: (\S+)[\s\S]*?exclude-pattern: '([^']*)'/g),
  ].map(([, appType, exclude]) => ({ appType, exclude }));
}

function stepOf(name) {
  const steps = DEPLOY.split(/\n(?=\s+- name: )/);
  const step = steps.find((part) => part.includes(`- name: ${name}\n`));
  assert.ok(step, `no step "${name}"`);
  return step;
}

describe('deploy.yml', () => {
  it('offers skip-cache and projects to a dispatch only', () => {
    const dispatch = blockOf(DEPLOY, 'workflow_dispatch');
    assert.match(dispatch, /skip-cache:\n\s+type: boolean\n\s+default: false/);
    assert.match(dispatch, /projects:\n\s+type: string\n\s+default: ''/);
    const call = blockOf(DEPLOY, 'workflow_call');
    assert.doesNotMatch(call, /skip-cache|projects/);
  });

  it('is called by release.yml with the version alone', () => {
    const withBlocks = [
      ...RELEASE.matchAll(/deploy\.yml[\s\S]*?with:\n((?:\s{6,}\S.*\n)+)/g),
    ];
    assert.ok(withBlocks.length > 0, 'release.yml does not call deploy.yml');
    for (const [, inputs] of withBlocks) {
      assert.deepEqual(
        inputs
          .trim()
          .split('\n')
          .map((line) => line.trim().split(':')[0]),
        ['version']
      );
    }
  });

  it('hands the named projects to the selection', () => {
    assert.match(
      blockOf(DEPLOY, 'env'),
      /DEPLOY_PROJECTS: \$\{\{ inputs\.projects \}\}/
    );
  });

  it('skips the Nx cache only when asked', () => {
    assert.match(
      blockOf(DEPLOY, 'env'),
      /NX_SKIP_NX_CACHE: \$\{\{ inputs\.skip-cache && 'true' \|\| 'false' \}\}/
    );
  });

  it('selects the named projects of each leg, else the affected ones', () => {
    const select = stepOf(
      'Select the projects to release and set triggerRelease'
    );
    assert.match(
      select,
      /deploy-override\.mjs --projects="\$DEPLOY_PROJECTS" --exclude='\$\{\{ matrix\.config\.exclude-pattern \}\}' --target="\$target"/
    );
    assert.match(select, /release-affected\.mjs/);
  });

  it('gives every leg an exclude pattern', () => {
    assert.deepEqual(
      legs().map((leg) => leg.appType),
      ['npm-packages', 'non-cdk', 'android', 'cdk']
    );
  });

  it('tags no override and leaves an existing tag alone', () => {
    const tag = stepOf('Tag deployment success');
    assert.match(tag, /if: .*env\.DEPLOY_PROJECTS == ''/);
    assert.match(tag, /git rev-parse -q --verify "refs\/tags\/\$DEPLOY_TAG"/);
  });

  it('prints the output of every Nx task', () => {
    const calls = DEPLOY.split('\n').filter((line) =>
      /npx nx (run-many|release publish)/.test(line)
    );
    assert.equal(calls.length, 3);
    for (const call of calls) assert.match(call, /--output-style=static/);
  });
});

describe('deploy-override', () => {
  it('reads a comma-separated list', () => {
    assert.deepEqual(requestedProjects(' korbjaeger, ,pacetrainer '), [
      'korbjaeger',
      'pacetrainer',
    ]);
    assert.throws(() => requestedProjects(' , '), /names no project/);
  });

  it('names the requested projects that are missing', () => {
    assert.deepEqual(missingProjects(['a', 'b'], ['b', 'c']), ['a']);
  });

  const run = (...args) =>
    execFileSync('node', [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter((line) => line !== '');
  const targetOf = (appType) =>
    appType === 'npm-packages' ? 'build' : 'deploy';

  it("keeps each leg's own kind of the named projects", () => {
    const expected = {
      'npm-packages': ['ws-thanos'],
      'non-cdk': ['korbjaeger'],
      android: [],
      cdk: ['korbjaeger-cdk'],
    };
    for (const { appType, exclude } of legs()) {
      assert.deepEqual(
        run(
          '--projects=korbjaeger,ws-thanos,korbjaeger-cdk',
          `--exclude=${exclude}`,
          `--target=${targetOf(appType)}`
        ).sort(),
        expected[appType],
        appType
      );
    }
  });

  it('fails on a name the workspace does not know', () => {
    assert.throws(
      () =>
        run('--projects=korbjagger', '--exclude=tag:cdk', '--target=deploy'),
      (error) => /unknown projects: korbjagger/.test(error.stderr)
    );
  });

  it("fails on a project of the leg without the leg's target", () => {
    assert.throws(
      () =>
        run(
          '--projects=korbjaeger,feat-shared-basketball-data',
          '--exclude=tag:cdk,tag:published,tag:type:android',
          '--target=deploy'
        ),
      (error) =>
        /no deploy target: feat-shared-basketball-data/.test(error.stderr)
    );
  });
});
