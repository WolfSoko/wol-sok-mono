const { execSync } = require('node:child_process');

module.exports = function latestVersionTag() {
  // Get latest version tag like v1.0.0 that matches the glob pattern
  try {
    const latestVersionTag = execSync(
      'git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*"'
    )
      .toString()
      .trim();
    if (!latestVersionTag.includes('deployed')) {
      return latestVersionTag;
    }
    const [major, minor, patch] = latestVersionTag.split('-')[0].split('.');
    return `${major}.${minor}.${parseInt(patch) + 1}-next`;
  } catch (error) {
    console.error(
      'Error while getting latest version tag. Returning commit hash',
      error
    );
    try {
      // get current commit hash
      return execSync('git rev-parse --short HEAD');
    } catch (error) {
      console.error(
        'Error while getting head commit hash. Returning a timestamp version',
        error
      );
    }
    return `t${Date.now()}`;
  }
};
