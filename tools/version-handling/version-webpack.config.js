'use strict';

const { execSync } = require('child_process');
const { DefinePlugin } = require('webpack');

const latestVersionTag = getLatestVersionTag();
console.log(`Version for build: ${latestVersionTag}`);

const withVersionHandling = (config, context) => ({
  plugins: [
    new DefinePlugin({
      VERSION: latestVersionTag,
    }),
  ],
});

module.exports = withVersionHandling;
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
