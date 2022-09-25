const versionFile = {
  filename: '.version',
  type: 'plain-text',
};

module.exports = {
  bumpFiles: [versionFile],
  packageFiles: [versionFile],
};
