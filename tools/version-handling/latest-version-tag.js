const { execSync } = require('node:child_process');

module.exports = function latestVersionTag() {
  // Get latest version tag like v1.0.0 that matches the regex pattern
  try {
    return execSync(
      'git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*"'
    )
      .toString()
      .trim();
  } catch (error) {
    console.error(
      'Error while getting latest version tag. Returning a timestamp version',
      error
    );
    return `t${Date.now()}`;
  }
};
