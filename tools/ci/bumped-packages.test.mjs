// Keeps the npm leg of deploy.yml on the packages the release bumped (#3049).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { bumpedPackages } from './bumped-packages.mjs';

const ROOT = join(dirname(import.meta.filename), '../..');
const SCRIPT = join(ROOT, 'tools/ci/bumped-packages.mjs');
const EMPTY_TREE = execFileSync(
  'git',
  ['hash-object', '-t', 'tree', '/dev/null'],
  {
    cwd: ROOT,
    encoding: 'utf8',
  }
).trim();

void describe('bumpedPackages', () => {
  const versions = {
    base: { a: '1.0.0', b: '2.0.0', d: '4.0.0' },
    head: { a: '1.0.1', b: '2.0.0', c: '3.0.0' },
  };
  const versionAt = (ref, name) => versions[ref][name];
  const packages = ['a', 'b', 'c', 'd'];

  void it('keeps a package whose version changed', () => {
    assert.ok(
      bumpedPackages(packages, versionAt, 'base', 'head').includes('a')
    );
  });

  void it('drops a package whose version stayed', () => {
    assert.ok(
      !bumpedPackages(packages, versionAt, 'base', 'head').includes('b')
    );
  });

  void it('keeps a package missing at the base', () => {
    assert.ok(
      bumpedPackages(packages, versionAt, 'base', 'head').includes('c')
    );
  });

  void it('drops a package missing at the head', () => {
    assert.deepEqual(bumpedPackages(packages, versionAt, 'base', 'head'), [
      'a',
      'c',
    ]);
  });
});

void describe('bumped-packages.mjs', () => {
  const run = (...args) =>
    execFileSync('node', [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter((line) => line !== '');

  void it('selects nothing where no version changed', () => {
    assert.deepEqual(
      run('--base=HEAD', '--head=HEAD', '--projects=tag:published'),
      []
    );
  });

  void it('selects every published package from the empty tree', () => {
    const published = JSON.parse(
      execFileSync(
        'npx',
        ['nx', 'show', 'projects', '--projects=tag:published', '--json'],
        { cwd: ROOT, encoding: 'utf8' }
      )
    );
    assert.ok(published.includes('ws-thanos'));
    assert.deepEqual(
      run(
        `--base=${EMPTY_TREE}`,
        '--head=HEAD',
        '--projects=tag:published'
      ).sort(),
      published.sort()
    );
  });

  void it('fails on a ref git does not know', () => {
    assert.throws(
      () =>
        run('--base=no-such-ref', '--head=HEAD', '--projects=tag:published'),
      (error) =>
        error.status === 1 &&
        /rev-parse --verify --quiet no-such-ref/.test(error.stderr)
    );
  });

  void it('fails on a pattern that matches no project', () => {
    assert.throws(
      () => run('--base=HEAD', '--head=HEAD', '--projects=tag:no-such-tag'),
      (error) => /matches none/.test(error.stderr)
    );
  });
});
