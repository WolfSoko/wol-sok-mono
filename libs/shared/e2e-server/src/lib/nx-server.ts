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

/** The project and target of the task Nx runs, set in every task. */
const NX_TASK_PROJECT_ENV = 'NX_TASK_TARGET_PROJECT';
const NX_TASK_TARGET_ENV = 'NX_TASK_TARGET_TARGET';

/**
 * The targets that run Playwright, as `@nx/playwright/plugin` infers them:
 * `targetName` and `ciTargetName` of its `nx.json` entry (the spec keeps them
 * equal) and the atomized `e2e-ci--<spec file>` tasks.
 */
export const PLAYWRIGHT_TARGETS = { e2e: 'e2e', ci: 'e2e-ci' } as const;

/**
 * The targets the plugin infers beside the spec files that never load the
 * config: the readiness gates and the merge of the atomized reports.
 */
const NON_PLAYWRIGHT_TARGETS: ReadonlySet<string> = new Set([
  `${PLAYWRIGHT_TARGETS.e2e}--wait-for-webserver`,
  `${PLAYWRIGHT_TARGETS.ci}--wait-for-webserver`,
  `${PLAYWRIGHT_TARGETS.ci}--merge-reports`,
]);

/**
 * The `webServer` entry of the Nx target `target` (`app:serve-e2e`), which
 * serves `url`.
 *
 * Run by hand, Playwright starts the target where nothing answers yet. Run
 * as one of the project's own Playwright tasks, Nx starts the target as the
 * task's continuous dependency, so Playwright only waits for it: Nx stops and
 * restarts continuous tasks between the batches an Nx Cloud agent runs, and a
 * second start of the same server, from Playwright, fails on its taken ports
 * while the first still boots ("Process from config.webServer exited early").
 *
 * Everywhere else the entry reads as by hand, inside other tasks too: a nested
 * `nx` call in any task (a Playwright `webServer` of another app, a test that
 * runs `nx show`) builds the project graph with the task's variables set, and
 * `@nx/playwright` infers the serve dependencies and the readiness gate only
 * from an `nx run` command. It caches that result under a key that leaves the
 * task's variables out, so a waiting command read there once dropped the gate
 * from every later graph on the worker (#3120). A graph built inside the
 * project's own Playwright tasks would still do so; none is today (no
 * `globalSetup`, no `nx` call in an `e2e/` folder), so keep it that way.
 *
 * `target` must belong to the project whose Playwright config holds the
 * entry: the task's project is compared with it. A hand-written target that
 * runs Playwright needs the dependency too, or its servers never start.
 */
export function nxServer(
  target: string,
  url: string,
  options: NxServerOptions,
  env: Readonly<Record<string, string | undefined>> = process.env
): NxServer {
  return {
    command: insideOwnPlaywrightTask(target, env)
      ? `node ${WAIT_FOR_SERVER_SCRIPT} ${url} ${options.timeout}`
      : `npx nx run ${target}`,
    url,
    reuseExistingServer: true,
    ...options,
  };
}

/** Whether Nx runs a Playwright task of the project that owns `target`. */
function insideOwnPlaywrightTask(
  target: string,
  env: Readonly<Record<string, string | undefined>>
): boolean {
  const [project] = target.split(':');
  return (
    env[NX_TASK_PROJECT_ENV] === project &&
    isPlaywrightTarget(env[NX_TASK_TARGET_ENV] ?? '')
  );
}

function isPlaywrightTarget(name: string): boolean {
  if (NON_PLAYWRIGHT_TARGETS.has(name)) {
    return false;
  }
  return (
    name === PLAYWRIGHT_TARGETS.e2e ||
    name === PLAYWRIGHT_TARGETS.ci ||
    name.startsWith(`${PLAYWRIGHT_TARGETS.ci}--`)
  );
}
