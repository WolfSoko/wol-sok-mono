const versionFile = {
  filename: 'version.json',
  type: 'json',
};

module.exports = {
  bumpFiles: [versionFile],
  packageFiles: [versionFile],
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'refactor', hidden: 'Refactorings' },
    { type: 'ci', hidden: 'Continuous Integration' },
    { type: 'chore', hidden: true },
    { type: 'docs', hidden: true },
    { type: 'style', hidden: true },
    { type: 'perf', hidden: true },
    { type: 'test', hidden: true },
  ],
};
