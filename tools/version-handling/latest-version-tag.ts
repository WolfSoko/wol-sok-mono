import { execSync } from 'node:child_process';
import { version } from '../../version.json';

/**
 * @returns {string} An app version like v1.0.0 a githash or a timestamp
 *
 * @param appDeployedPrefix filter to find the appropriate version tag
 *
 */
export function latestVersionTag(
  appDeployedPrefix: string | 'non-cdk-deployed' | 'cdk-deployed'
): string {
  // read version from version.json
  if (!appDeployedPrefix) return version;

  // Get latest version tag like v1.0.0 that matches the glob pattern
  try {
    const latestVersionTag = execSync(
      'git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*"'
    )
      .toString()
      .trim();
    const isDeployedRegex = new RegExp(
      'v[0-9]*.[0-9]*.[0-9]-' + appDeployedPrefix
    );
    if (!isDeployedRegex.test(latestVersionTag)) {
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
      return execSync('git rev-parse --short HEAD').toString();
    } catch (error) {
      console.error(
        'Error while getting head commit hash. Returning a timestamp version',
        error
      );
    }
    return `t${Date.now()}`;
  }
}
