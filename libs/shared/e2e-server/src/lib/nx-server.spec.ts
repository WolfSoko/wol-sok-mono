import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import {
  nxServer,
  PLAYWRIGHT_TARGETS,
  WAIT_FOR_SERVER_SCRIPT,
} from './nx-server';

const WORKSPACE = join(__dirname, '../../../../..');
const OPTIONS = { cwd: WORKSPACE, timeout: 2000 };
const URL = 'http://127.0.0.1:9199';

interface NxJson {
  readonly plugins: readonly (
    | string
    | {
        readonly plugin: string;
        readonly options?: {
          readonly targetName?: string;
          readonly ciTargetName?: string;
        };
      }
  )[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(WORKSPACE, path), 'utf8')) as T;
}

describe('nxServer', () => {
  it('starts the Nx target when Playwright runs by hand', () => {
    expect(nxServer('app:emulators', URL, OPTIONS, {})).toEqual({
      command: 'npx nx run app:emulators',
      url: URL,
      reuseExistingServer: true,
      ...OPTIONS,
    });
  });

  it.each(['e2e', 'e2e-ci', 'e2e-ci--e2e/online.spec.ts'])(
    'only waits inside a %s task of its own project, where Nx starts the server',
    (target) => {
      const server = nxServer('app:emulators', URL, OPTIONS, {
        NX_TASK_TARGET_PROJECT: 'app',
        NX_TASK_TARGET_TARGET: target,
      });

      expect(server.command).toBe(`node ${WAIT_FOR_SERVER_SCRIPT} ${URL} 2000`);
      expect(server.reuseExistingServer).toBe(true);
    }
  );

  // A nested `nx` call inside any other task builds the project graph with
  // these variables set, and @nx/playwright caches what it inferred under a
  // key that leaves them out (#3120): the config must read as by hand there.
  it.each([
    [
      'an e2e task of another project',
      'angular-examples',
      'e2e-ci--e2e/home.spec.ts',
    ],
    ['a test task of another project', 'tools', 'test'],
    ['another task of its own project', 'app', 'test-emulator'],
    ['the readiness gate of its own project', 'app', 'e2e--wait-for-webserver'],
    ['the ci gate of its own project', 'app', 'e2e-ci--wait-for-webserver'],
    ['the report merge of its own project', 'app', 'e2e-ci--merge-reports'],
  ])('starts the Nx target inside %s', (_, project, target) => {
    const server = nxServer('app:emulators', URL, OPTIONS, {
      NX_TASK_TARGET_PROJECT: project,
      NX_TASK_TARGET_TARGET: target,
    });

    expect(server.command).toBe('npx nx run app:emulators');
  });

  // Named after the plugin's targets: a rename there would silently start a
  // second server from Playwright inside the project's own tasks again.
  it('knows the Playwright targets nx.json names', () => {
    const playwright = readJson<NxJson>('nx.json').plugins.find(
      (entry) =>
        typeof entry !== 'string' && entry.plugin === '@nx/playwright/plugin'
    );
    const options = typeof playwright === 'string' ? {} : playwright?.options;

    expect(options?.targetName).toBe(PLAYWRIGHT_TARGETS.e2e);
    // the plugin's default
    expect(options?.ciTargetName ?? 'e2e-ci').toBe(PLAYWRIGHT_TARGETS.ci);
  });

  // The task's project is compared with the target's: a server of another
  // project would start twice inside the config's own e2e tasks. The apps'
  // configs and project files are inputs of this lib's test target.
  it.each(
    readdirSync(join(WORKSPACE, 'apps')).filter((app) =>
      existsSync(join(WORKSPACE, 'apps', app, 'playwright.config.ts'))
    )
  )('serves only targets of its own project in apps/%s', (app) => {
    const config = readFileSync(
      join(WORKSPACE, 'apps', app, 'playwright.config.ts'),
      'utf8'
    );
    const { name } = readJson<{ name: string }>(`apps/${app}/project.json`);
    const servedProjects = [...config.matchAll(/nxServer\(\s*'([^':]+):/g)].map(
      ([, project]) => project
    );

    expect(servedProjects.filter((project) => project !== name)).toEqual([]);
  });

  it('names a waiting script that exists', () => {
    expect(existsSync(join(WORKSPACE, WAIT_FOR_SERVER_SCRIPT))).toBe(true);
  });
});

describe('the waiting script', () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  /** Runs the script; resolves with its output and its exit code, null while it still runs. */
  function waitForServer(url: string, timeoutMs: number) {
    const child = spawn(
      'node',
      [WAIT_FOR_SERVER_SCRIPT, url, String(timeoutMs)],
      {
        cwd: WORKSPACE,
      }
    );
    return new Promise<{ output: string; code: number | null }>((resolve) => {
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += String(chunk);
        // it stays up once the server answered: Playwright ends it
        setTimeout(() => {
          resolve({ output, code: child.exitCode });
          child.kill();
        }, 300);
      });
      child.stderr.on('data', (chunk) => (output += String(chunk)));
      child.on('exit', (code) => resolve({ output, code }));
    });
  }

  it('waits for a server that comes up late, and stays up', async () => {
    server = createServer((_, response) => response.end('ok'));
    server.listen(0);
    await new Promise((resolve) => server?.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    server.close();
    setTimeout(() => server?.listen(port), 500);

    const { output, code } = await waitForServer(
      `http://127.0.0.1:${port}`,
      5000
    );

    expect(output).toContain('is up');
    expect(code).toBeNull();
  });

  it('fails where no server answers in time', async () => {
    const { output, code } = await waitForServer('http://127.0.0.1:9', 300);

    expect(code).toBe(1);
    expect(output).toContain('No server answered');
  });
});
