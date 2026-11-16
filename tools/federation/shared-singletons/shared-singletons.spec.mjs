import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  DEV_MANIFEST_PATH,
  MANIFEST_PATH,
  describeFinding,
  SHELL,
  missingSingletons,
} from './shared-singletons.mjs';

const entry = (packageName, version = '1.0.0', singleton = true) => ({
  packageName,
  version,
  singleton,
});

describe('missingSingletons', () => {
  it('reports a singleton a remote shares and the shell lacks', () => {
    const findings = missingSingletons([entry('firebase/app')], {
      game: [entry('firebase/app'), entry('firebase/firestore', '12.19.0')],
    });

    assert.deepEqual(findings, [
      {
        remote: 'game',
        packageName: 'firebase/firestore',
        remoteVersion: '12.19.0',
        shellVersion: undefined,
      },
    ]);
  });

  it('reports a singleton the shell shares at another version', () => {
    const findings = missingSingletons([entry('rxjs', '7.8.1')], {
      game: [entry('rxjs', '7.8.2')],
    });

    assert.deepEqual(findings, [
      {
        remote: 'game',
        packageName: 'rxjs',
        remoteVersion: '7.8.2',
        shellVersion: '7.8.1',
      },
    ]);
  });

  it('accepts a singleton the shell shares at the same version', () => {
    const findings = missingSingletons([entry('@angular/core', '22.2.6')], {
      game: [entry('@angular/core', '22.2.6')],
      fourier: [entry('@angular/core', '22.2.6')],
    });

    assert.deepEqual(findings, []);
  });

  it('ignores entries that are no singletons', () => {
    const findings = missingSingletons([], {
      game: [
        entry('p5', '2.0.0', false),
        entry('@nf-internal/chunk-ABC', '0.0.0', false),
      ],
    });

    assert.deepEqual(findings, []);
  });

  it('reports a singleton the shell shares only as a non-singleton', () => {
    const findings = missingSingletons([entry('p5', '2.0.0', false)], {
      game: [entry('p5', '2.0.0')],
    });

    assert.deepEqual(findings, [
      {
        remote: 'game',
        packageName: 'p5',
        remoteVersion: '2.0.0',
        shellVersion: undefined,
      },
    ]);
  });

  it('reports nothing for remotes that share nothing', () => {
    assert.deepEqual(missingSingletons([entry('rxjs')], { game: [] }), []);
  });
});

describe('describeFinding', () => {
  it('names a missing singleton, without a version it lacks', () => {
    assert.match(
      describeFinding({ remote: 'game', packageName: 'rxjs' }),
      /^game shares the singleton rxjs, but the shell .* does not share it as a singleton/
    );
  });

  it('names both versions of a mismatch', () => {
    assert.match(
      describeFinding({
        remote: 'game',
        packageName: 'rxjs',
        remoteVersion: '7.8.2',
        shellVersion: '7.8.1',
      }),
      /rxjs@7\.8\.2, but the shell .* shares 7\.8\.1: the versions disagree/
    );
  });
});

describe('federation-shared-singletons project', () => {
  const root = join(import.meta.dirname, '../../..');
  const remotesOf = (path) =>
    Object.keys(JSON.parse(readFileSync(join(root, path), 'utf8'))).sort();

  it('checks the same remotes the development manifest lists', () => {
    assert.deepEqual(remotesOf(DEV_MANIFEST_PATH), remotesOf(MANIFEST_PATH));
  });

  it('depends on the shell and every remote of its production manifest', () => {
    const project = JSON.parse(
      readFileSync(join(import.meta.dirname, 'project.json'), 'utf8')
    );

    assert.deepEqual(
      [...project.implicitDependencies].sort(),
      [SHELL, ...remotesOf(MANIFEST_PATH)].sort()
    );
  });
});
