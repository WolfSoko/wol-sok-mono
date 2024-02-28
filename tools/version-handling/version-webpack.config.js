'use strict';

const { execSync } = require('child_process');
const { DefinePlugin } = require('webpack');

const latestVersionTag = getLatestVersionTag();
console.log(`Version for build: ${latestVersionTag}`);

module.exports = function withVersionHandling(config, context) {
  return {
    plugins: [
      new DefinePlugin({
        VERSION: latestVersionTag,
      }),
    ],
  };
};
function getLatestVersionTag() {
  // Get latest version tag like v1.0.0 that matches the regex pattern
  let version;
  try {
    version = execSync(
      'git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*"'
    )
      .toString()
      .trim();
    return version;
  } catch (error) {
    console.error('Error while getting latest version tag', error);
    return `t${Date.now()}`;
  }
}
