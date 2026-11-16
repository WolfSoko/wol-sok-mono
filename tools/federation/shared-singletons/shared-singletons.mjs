/**
 * The rule behind `federation-shared-singletons:test` (#3085): every singleton
 * a remote shares has to be shared by the shell at the same version. Where the
 * shell lacks it, the remote brings its own copy into the shell (for a
 * `firebase/*` entry with its own `@firebase/app`, a second component
 * registry), since `ignoreUnusedDeps` in `workspace-federation.js` prunes the
 * shell's shared entries to what the shell itself imports.
 */

/** The federation shell; the remotes are the keys of its prod manifest. */
export const SHELL = 'angular-examples';

/** The shell's production manifest, relative to the workspace root. */
export const MANIFEST_PATH = `apps/${SHELL}/src/assets/federation.manifest.prod.json`;

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
    shellShared.map((entry) => [entry.packageName, entry.version])
  );
  return Object.entries(remotesShared).flatMap(([remote, shared]) =>
    shared
      .filter((entry) => entry.singleton)
      .filter(
        (entry) =>
          !shellVersions.has(entry.packageName) ||
          shellVersions.get(entry.packageName) !== entry.version
      )
      .map((entry) => ({
        remote,
        packageName: entry.packageName,
        remoteVersion: entry.version,
        shellVersion: shellVersions.get(entry.packageName),
      }))
  );
}

/** @param {Finding} finding */
export function describeFinding({
  remote,
  packageName,
  remoteVersion,
  shellVersion,
}) {
  const shell =
    shellVersion === undefined
      ? `the shell (${SHELL}) does not share it`
      : `the shell (${SHELL}) shares ${shellVersion}`;
  return `${remote} shares the singleton ${packageName}@${remoteVersion}, but ${shell}: inside the shell it loads a second copy.`;
}
