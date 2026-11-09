/** A Playwright `webServer` entry, as the Nx target of the server. */
export interface NxServer {
  readonly command: string;
  readonly url: string;
  readonly reuseExistingServer: true;
  readonly cwd: string;
  readonly timeout: number;
}

/** The waiting command, from the workspace root (`cwd`). */
const ABWARTEN = 'node apps/korbjaeger/e2e/server/abwarten.mjs';

/**
 * The `webServer` entry of the Nx target `ziel`, which serves `url`.
 *
 * Run by hand, Playwright starts the target where nothing answers yet. Run
 * as an Nx task (`NX_TASK_TARGET_PROJECT` is set), Nx starts the target as
 * the task's continuous dependency, so Playwright only waits for it: Nx
 * stops and restarts continuous tasks between the batches an Nx Cloud agent
 * runs, and a second start of the same server, from Playwright, fails on
 * its taken ports while the first still boots ("exited early"). The plugin
 * infers the dependency from the `nx run` command, read outside any task.
 */
export function nxServer(
  ziel: string,
  url: string,
  optionen: { readonly cwd: string; readonly timeout: number },
  umgebung: Readonly<Record<string, string | undefined>> = process.env
): NxServer {
  const inNxTask = umgebung['NX_TASK_TARGET_PROJECT'] !== undefined;
  return {
    command: inNxTask
      ? `${ABWARTEN} ${url} ${optionen.timeout}`
      : `npx nx run ${ziel}`,
    url,
    reuseExistingServer: true,
    ...optionen,
  };
}
