/**
 * Which configuration Korbjäger's `build` ran with, recorded beside its
 * output, so the deploy can refuse anything but a production build.
 *
 * Nx hands a command's `--configuration` to every dependency that has one,
 * and `dependsOn` cannot pin it: `nx run korbjaeger:deploy -c development`
 * would build for development (sign-in against the local emulators) and
 * deploy that.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

function main([command, distDir, configuration]: string[]): void {
  if (command === 'record' && distDir && configuration) {
    recordBuildConfiguration(distDir, configuration);
  } else if (command === 'check' && distDir) {
    assertDeployableBuild(distDir);
  } else {
    throw new Error(
      'Usage: build-configuration.ts record <dist> <configuration> | check <dist>'
    );
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
