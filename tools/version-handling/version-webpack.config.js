const { execSync } = require('child_process');

module.exports = function withVersionHandling(config, context) {
  return {
    plugins: [
      new DefinePlugin({
        VERSION: getLatestVersionTag(),
      }),
    ],
  };
};

function getLatestVersionTag() {
  // Get latest version tag like v1.0.0 that matches the regex pattern
  const version = execSync(
    'git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*"'
  )
    .toString()
    .trim();
  if (!version) {
    return 'vx.x.x';
  }
  return version;
}
