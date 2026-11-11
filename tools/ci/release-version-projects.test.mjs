// Keeps the release from versioning, and so publishing, packages whose build
// reads none of the files changed since their last release tag (#3020).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { selectReleaseAffected } from './release-affected.mjs';
import { releaseVersionProjects } from './release-version-projects.mjs';

const TAGS = {
  'nx-aws-cdk-v2': 'nx-aws-cdk-v2@4.2.6',
  'spa-cdk-stack': 'spa-cdk-stack@1.2.25',
  'ws-thanos': 'ws-thanos@18.4.23',
};

const BUILD_INPUTS = {
  'nx-aws-cdk-v2': ['libs/public/nx-aws-cdk-v2/src/index.ts'],
  'spa-cdk-stack': ['libs/public/spa-cdk-stack/src/index.ts'],
  'ws-thanos': ['libs/public/ws-thanos/src/index.ts'],
};

/**
 * Versions the packages for files changed since their tags, judged by the
 * real selection with fixed inputs; every package counts as Nx-affected.
 */
async function versioned(changedFiles, tags = TAGS) {
  const ranges = [];
  const { selected } = await releaseVersionProjects({
    head: 'HEAD',
    packages: Object.keys(BUILD_INPUTS),
    lastTagOf: async (project) => tags[project],
    select: async (range) => {
      ranges.push(range);
      return selectReleaseAffected({
        candidates: [range.project],
        changedFiles,
        deletedFiles: [],
        inputsOf: (project) => new Set(BUILD_INPUTS[project]),
      });
    },
  });
  return { selected, ranges };
}

describe('releaseVersionProjects', () => {
  for (const file of ['.oxlintrc.json', 'eslint.config.mjs']) {
    it(`versions no package for a change to ${file} only`, async () => {
      assert.deepEqual((await versioned([file])).selected, []);
    });
  }

  it('versions only the package whose sources changed', async () => {
    const { selected } = await versioned([
      '.oxlintrc.json',
      'libs/public/ws-thanos/src/index.ts',
    ]);
    assert.deepEqual(selected, ['ws-thanos']);
  });

  it('judges each package from its own last tag to the head', async () => {
    const { ranges } = await versioned([]);
    assert.deepEqual(
      ranges,
      Object.entries(TAGS).map(([project, base]) => ({
        base,
        head: 'HEAD',
        project,
      }))
    );
  });

  it('versions a package without a release tag', async () => {
    const { selected, ranges } = await versioned(['.oxlintrc.json'], {
      ...TAGS,
      'ws-thanos': undefined,
    });
    assert.deepEqual(selected, ['ws-thanos']);
    assert.equal(
      ranges.some(({ project }) => project === 'ws-thanos'),
      false
    );
  });

  it("keeps every package where a root package.json keeps Nx's verdict", async () => {
    const { selected } = await versioned(['package.json']);
    assert.deepEqual(selected, Object.keys(BUILD_INPUTS));
  });

  it('versions no package Nx does not call affected', async () => {
    const { selected } = await releaseVersionProjects({
      head: 'HEAD',
      packages: ['ws-thanos'],
      lastTagOf: async () => 'ws-thanos@18.4.23',
      select: async () => ({ selected: [], reasons: {} }),
    });
    assert.deepEqual(selected, []);
  });
});
