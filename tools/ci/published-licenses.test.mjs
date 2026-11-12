// Keeps every published package's licence its own (#2969): an npm tarball
// carries a LICENSE with exactly the MIT part of the root LICENSE, never the
// root file, whose Scope paragraph names proprietary folders the package does
// not contain, and its package.json says "MIT".
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, readJson, readProjects } from './workspace-projects.mjs';

// The heading on a line of its own: the Scope paragraph names "The MIT License" too.
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

function assetPath(asset) {
  if (typeof asset === 'string') return asset;
  return join(asset.input ?? '', asset.glob ?? '');
}

/** The LICENSE paths a build target copies, relative to the workspace root. */
function copiedLicenses(project) {
  const root = projectRootOf(project);
  const options = project.json.targets?.build?.options ?? {};
  const assets = options.project
    ? (readJson(options.project).assets ?? []).map((asset) =>
        join(root, assetPath(asset))
      )
    : (options.assets ?? []).map((asset) => join(assetPath(asset)));
  return assets.filter((path) => path.endsWith('LICENSE'));
}

describe('published packages', () => {
  const projects = publishedProjects();

  it('are found', () => {
    assert.ok(projects.length > 0, 'no project is tagged "published"');
  });

  for (const project of projects) {
    const root = projectRootOf(project);

    describe(project.json.name, () => {
      it('hold the MIT part of the root LICENSE, byte for byte', () => {
        const license = join(ROOT, root, 'LICENSE');
        assert.ok(existsSync(license), `${root}/LICENSE is missing`);
        assert.equal(readFileSync(license, 'utf8'), rootMitText());
      });

      it('declare "MIT" in their package.json', () => {
        assert.equal(readJson(join(root, 'package.json')).license, 'MIT');
      });

      it('copy their own LICENSE into the build, not the root one', () => {
        assert.deepEqual(copiedLicenses(project), [join(root, 'LICENSE')]);
      });
    });
  }
});
