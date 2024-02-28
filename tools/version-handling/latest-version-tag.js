import { execSync } from 'child_process';

export function latestVersionTag() {
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
    console.error(
      'Error while getting latest version tag. Returning a timestamp version',
      error
    );
    return `t${Date.now()}`;
  }
}
