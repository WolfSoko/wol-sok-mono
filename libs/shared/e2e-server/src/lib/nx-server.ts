/** A Playwright `webServer` entry, served by an Nx target. */
export interface NxServer {
  readonly command: string;
  readonly url: string;
  readonly reuseExistingServer: true;
  readonly cwd: string;
  readonly timeout: number;
}

/** Where the command runs (the workspace root) and how long it may take. */
export interface NxServerOptions {
  readonly cwd: string;
  readonly timeout: number;
}

/** The waiting script, from the workspace root (`cwd`). */
export const WAIT_FOR_SERVER_SCRIPT =
  'libs/shared/e2e-server/src/wait-for-server.mjs';

/** Set by Nx in every task it runs. */
const NX_TASK_ENV = 'NX_TASK_TARGET_PROJECT';

/**
 * The `webServer` entry of the Nx target `target` (`app:serve-e2e`), which
 * serves `url`.
 *
 * Run by hand, Playwright starts the target where nothing answers yet. Run
 * as an Nx task, Nx starts the target as the task's continuous dependency,
 * so Playwright only waits for it: Nx stops and restarts continuous tasks
 * between the batches an Nx Cloud agent runs, and a second start of the
 * same server, from Playwright, fails on its taken ports while the first
 * still boots ("Process from config.webServer exited early"). `@nx/playwright`
 * reads the config outside any task, so it still infers the dependency from
 * the `nx run` command. A hand-written target that runs Playwright needs
 * that dependency too, or its servers never start.
 */
export function nxServer(
  target: string,
  url: string,
  options: NxServerOptions,
  env: Readonly<Record<string, string | undefined>> = process.env
): NxServer {
  const insideNxTask = env[NX_TASK_ENV] !== undefined;
  return {
    command: insideNxTask
      ? `node ${WAIT_FOR_SERVER_SCRIPT} ${url} ${options.timeout}`
      : `npx nx run ${target}`,
    url,
    reuseExistingServer: true,
    ...options,
  };
}
