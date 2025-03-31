const versionFile = {
  filename: 'version.json',
  type: 'json',
};

export default {
  bumpFiles: [versionFile],
  packageFiles: [versionFile],
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'refactor', section: 'Refactorings' },
    { type: 'ci', section: 'CI/CD' },
    { type: 'chore', section: 'Chore' },
    { type: 'docs', section: 'Documentation' },
    { type: 'style', section: 'Code style' },
    { type: 'perf', section: 'Performance' },
    { type: 'test', section: 'Testing' },
  ],
};
