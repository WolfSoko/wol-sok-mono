const name = 'ws-thanos';
const srcRoot = 'libs/public/ws-thanos/src';

module.exports = {
  extends: 'release.config.base.js',
  pkgRoot: 'dist/libs/public/ws-thanos',
  tagFormat: `${name}-v\${version}`,
  commitPaths: [`${srcRoot}/*`],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: `${srcRoot}/CHANGELOG.md`,
      },
    ],
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: [`${srcRoot}/CHANGELOG.md`, `${srcRoot}/package.json`],
        message: `release(version): Release ${name} \${nextRelease.version} [skip ci]\n\n\${nextRelease.notes}`,
      },
    ],
  ],
};
