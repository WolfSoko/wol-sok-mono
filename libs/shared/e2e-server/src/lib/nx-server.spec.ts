import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { nxServer, WAIT_FOR_SERVER_SCRIPT } from './nx-server';

const WORKSPACE = join(__dirname, '../../../../..');
const OPTIONS = { cwd: WORKSPACE, timeout: 2000 };
const URL = 'http://127.0.0.1:9199';

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
    'only waits inside its own project’s %s task, where Nx starts the server',
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
      'another project’s e2e task',
      'angular-examples',
      'e2e-ci--e2e/home.spec.ts',
    ],
    ['another project’s test task', 'tools', 'test'],
    ['its own project’s other task', 'app', 'test-emulator'],
    ['its own project’s readiness gate', 'app', 'e2e--wait-for-webserver'],
  ])('starts the Nx target inside %s', (_, project, target) => {
    const server = nxServer('app:emulators', URL, OPTIONS, {
      NX_TASK_TARGET_PROJECT: project,
      NX_TASK_TARGET_TARGET: target,
    });

    expect(server.command).toBe('npx nx run app:emulators');
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
