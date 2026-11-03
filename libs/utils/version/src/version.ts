// The one import of the root `version.json` in the workspace's sources: the
// project declares the file as an input (`workspaceVersion` in project.json),
// so every task that depends on this lib reruns when the release bumps it.
import { version } from '../../../../version.json';

/** The workspace's release version, as the release workflow wrote it. */
export const WORKSPACE_VERSION: string = version;

/**
 * The name of the release the release workflow creates for `project`
 * (`.github/actions/create-release`): `<project>@v<version>`, the git tag
 * after the `@`.
 */
export function releaseName(project: string): string {
  return `${project}@v${WORKSPACE_VERSION}`;
}
