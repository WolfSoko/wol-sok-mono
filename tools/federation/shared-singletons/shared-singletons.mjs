/**
 * The rule behind `federation-shared-singletons:test` (#3085): every singleton
 * a remote shares has to be shared by the shell as a singleton at the same
 * version. Where the shell lacks it, the remote brings its own copy into the
 * shell (for a `firebase/*` entry with its own `@firebase/app`, a second
 * component registry), since `ignoreUnusedDeps` in `workspace-federation.js`
 * prunes the shell's shared entries to what the shell itself imports.
 */

/** The federation shell; the remotes are the keys of its prod manifest. */
export const SHELL = 'angular-examples';

/** The shell's manifests, relative to the workspace root. */
export const MANIFEST_PATH = `apps/${SHELL}/src/assets/federation.manifest.prod.json`;
export const DEV_MANIFEST_PATH = `apps/${SHELL}/src/assets/federation.manifest.json`;

/**
 * @typedef {{ packageName: string, version?: string, singleton: boolean }} SharedEntry
 * @typedef {{ remote: string, packageName: string, remoteVersion?: string, shellVersion?: string }} Finding
 */

/**
 * @param {SharedEntry[]} shellShared the `shared` list of the shell's remoteEntry.json
 * @param {Record<string, SharedEntry[]>} remotesShared each remote's `shared` list, by name
 * @returns {Finding[]} one finding per remote singleton the shell lacks or shares at another version
 */
export function missingSingletons(shellShared, remotesShared) {
  const shellVersions = new Map(
    shellShared
      .filter((entry) => entry.singleton)
      .map((entry) => [entry.packageName, entry.version])
  );
  return Object.entries(remotesShared).flatMap(([remote, shared]) =>
    shared.flatMap(({ packageName, version, singleton }) => {
      const covered =
        shellVersions.has(packageName) &&
        shellVersions.get(packageName) === version;
      return singleton && !covered
        ? [
            {
              remote,
              packageName,
              remoteVersion: version,
              shellVersion: shellVersions.get(packageName),
            },
          ]
        : [];
    })
  );
}

/** @param {string} packageName @param {string | undefined} version */
const named = (packageName, version) =>
  version === undefined ? packageName : `${packageName}@${version}`;

/** @param {Finding} finding */
export function describeFinding({
  remote,
  packageName,
  remoteVersion,
  shellVersion,
}) {
  const prefix = `${remote} shares the singleton ${named(packageName, remoteVersion)}, but the shell (${SHELL})`;
  return shellVersion === undefined
    ? `${prefix} does not share it as a singleton: inside the shell the remote loads a copy of its own.`
    : `${prefix} shares ${shellVersion}: the versions disagree, so the remote cannot use the shell's copy.`;
}
