// Keeps every published package's licence its own (#2969): an npm tarball
// carries a LICENSE with exactly the MIT part of the root LICENSE, never the
// root file, whose Scope paragraph names proprietary folders the package does
// not contain, and its package.json says "MIT".
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, matchesGlob, normalize } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, readJson, readProjects } from './workspace-projects.mjs';

// The heading on a line of its own: the Scope paragraph names "The MIT License" too.
const LICENSE = 'LICENSE';
const MIT_HEADING = /^MIT License$/m;

function rootMitText() {
  const root = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
  const heading = MIT_HEADING.exec(root);
  assert.ok(heading, 'the root LICENSE has no "MIT License" heading');
  return root.slice(heading.index);
}

function projectRootOf(project) {
  return project.path.replace(/\/?project\.json$/, '');
}

function publishedProjects() {
  return readProjects().filter((project) =>
    (project.json.tags ?? []).includes('published')
  );
}

/**
 * An asset as `{ input, glob, output }`, its input relative to the workspace
 * root. `@nx/js:tsc` resolves assets from the workspace root, ng-packagr from
 * the project root; a plain path copies its file to the package root.
 */
function normalizedAsset(asset, base) {
  if (typeof asset === 'string') {
    const path = join(base, asset);
    return { input: dirname(path), glob: basename(path), output: '.' };
  }
  return {
    input: join(base, asset.input ?? '.'),
    glob: asset.glob ?? '',
    output: normalize(asset.output ?? '.').replace(/^\/$/, '.'),
  };
}

function buildAssets(project) {
  const root = projectRootOf(project);
  const options = project.json.targets?.build?.options ?? {};
  return options.project
    ? (readJson(options.project).assets ?? []).map((asset) =>
        normalizedAsset(asset, root)
      )
    : (options.assets ?? []).map((asset) => normalizedAsset(asset, '.'));
}

/**
 * Where a build copies a LICENSE from and to: every asset whose glob takes a
 * `LICENSE` file lying in its input folder, a broader glob over the
 * workspace root included.
 */
function copiedLicenses(project) {
  return buildAssets(project)
    .filter(
      ({ input, glob }) =>
        matchesGlob(LICENSE, glob) && existsSync(join(ROOT, input, LICENSE))
    )
    .map(({ input, output }) => ({ input, output }));
}

void describe('published packages', () => {
  const projects = publishedProjects();

  void it('are found', () => {
    assert.ok(projects.length > 0, 'no project is tagged "published"');
  });

  for (const project of projects) {
    const root = projectRootOf(project);

    void describe(project.json.name, () => {
      void it('hold the MIT part of the root LICENSE, byte for byte', () => {
        const license = join(ROOT, root, 'LICENSE');
        assert.ok(existsSync(license), `${root}/LICENSE is missing`);
        assert.equal(readFileSync(license, 'utf8'), rootMitText());
      });

      void it('declare "MIT" in their package.json', () => {
        assert.equal(readJson(join(root, 'package.json')).license, 'MIT');
      });

      void it('copy their own LICENSE to the package root, and no other', () => {
        assert.deepEqual(copiedLicenses(project), [
          { input: root, output: '.' },
        ]);
      });
    });
  }
});
