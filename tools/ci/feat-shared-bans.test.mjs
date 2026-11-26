// Keeps the `feat-shared` tag constraint in `.oxlintrc.json` the one guard of
// what a `feat-shared` lib may import (#3237). The engine
// (`feat-shared-bacteria-engine`) runs in the Cloud Functions too (ADR 0011),
// so it must reach no Angular, NgRx, RxJS or Firebase package and neither the
// game's rendering nor its sound lib; no override of its own repeats that.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readJson } from './workspace-projects.mjs';

const BANNED_PACKAGES = [
  '@angular/*',
  '@ngrx/*',
  'rxjs',
  'rxjs/*',
  'firebase',
  'firebase/*',
];
const ENGINE_PROJECT = 'libs/features/bacteria-engine/project.json';
const BROWSER_ONLY_LIBS = [
  'libs/features/bacteria-rendering/project.json',
  'libs/features/bacteria-sound/project.json',
];

function featSharedConstraint() {
  const [, { depConstraints }] =
    readJson('.oxlintrc.json').rules['@nx/enforce-module-boundaries'];
  const constraint = depConstraints.find(
    ({ sourceTag }) => sourceTag === 'feat-shared'
  );
  assert.ok(constraint, 'no feat-shared depConstraint in .oxlintrc.json');
  return constraint;
}

void describe('the feat-shared tag constraint', () => {
  void it('applies to the engine', () => {
    assert.ok(readJson(ENGINE_PROJECT).tags.includes('feat-shared'));
  });

  void it('bans the packages that keep a lib out of Node', () => {
    const banned = featSharedConstraint().bannedExternalImports ?? [];
    assert.deepEqual(
      BANNED_PACKAGES.filter((name) => !banned.includes(name)),
      []
    );
  });

  void it("allows no tag of the game's rendering or sound lib", () => {
    const allowed = featSharedConstraint().onlyDependOnLibsWithTags ?? [];
    assert.notDeepEqual(allowed, [], 'feat-shared names no allowed tags');
    const reachable = BROWSER_ONLY_LIBS.filter((path) =>
      readJson(path).tags.some((tag) => allowed.includes(tag))
    );
    assert.deepEqual(reachable, []);
  });

  void it('is not repeated by an import ban for the engine', () => {
    const repeating = readJson('.oxlintrc.json')
      .overrides.filter(
        ({ files, rules }) =>
          'no-restricted-imports' in (rules ?? {}) &&
          files.some((glob) =>
            glob.startsWith('libs/features/bacteria-engine/')
          )
      )
      .map(({ files }) => files.join(', '));
    assert.deepEqual(repeating, []);
  });
});
