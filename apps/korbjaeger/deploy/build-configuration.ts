/**
 * Which mode Korbjäger's `build-app` built in, recorded beside its output
 * by the build itself (`rememberBuildConfiguration`, a Vite plugin), so the
 * deploy can refuse anything but a production build.
 *
 * Nx hands a command's `--configuration` to every dependency that has one,
 * and `dependsOn` cannot pin it: `nx run korbjaeger:deploy -c development`
 * would build for development (sign-in against the local emulators) and
 * deploy that. Recorded with the artifacts, it is one of `build-app`'s
 * outputs: a build restored from Nx's cache, or left from an earlier run
 * (`--excludeTaskDependencies`), brings the mode it was built in.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

export const BUILD_CONFIGURATION_FILE = 'build-configuration';
export const DEPLOYABLE_CONFIGURATION = 'production';

export function recordBuildConfiguration(
  distDir: string,
  configuration: string
): void {
  const file = join(distDir, BUILD_CONFIGURATION_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${configuration}\n`);
}

/** The Vite plugin that records the build's mode in `distDir` once written. */
export function rememberBuildConfiguration(distDir: string): Plugin {
  let mode = 'unknown';
  return {
    name: 'korbjaeger-build-configuration',
    apply: 'build',
    configResolved: (config) => {
      mode = config.mode;
    },
    writeBundle: () => recordBuildConfiguration(distDir, mode),
  };
}

/** Throws unless the last build in `distDir` was a production build. */
export function assertDeployableBuild(distDir: string): void {
  const configuration = readBuildConfiguration(distDir);
  if (configuration !== DEPLOYABLE_CONFIGURATION) {
    throw new Error(
      `Refusing to deploy a "${configuration ?? 'unknown'}" build of Korbjäger: only a ${DEPLOYABLE_CONFIGURATION} build may go live. Run the deploy without --configuration.`
    );
  }
}

function readBuildConfiguration(distDir: string): string | undefined {
  try {
    return readFileSync(join(distDir, BUILD_CONFIGURATION_FILE), 'utf8').trim();
  } catch {
    return undefined;
  }
}

function main([command, distDir]: string[]): void {
  if (command === 'check' && distDir) {
    assertDeployableBuild(distDir);
  } else {
    throw new Error('Usage: build-configuration.ts check <dist>');
  }
}

if (process.argv[1]?.endsWith('build-configuration.ts')) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
