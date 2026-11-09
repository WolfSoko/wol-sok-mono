// @vitest-environment node
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { nxServer } from '../e2e/server/nx-server';

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url));
const OPTIONEN = { cwd: WORKSPACE, timeout: 2000 };

describe("the e2e's servers", () => {
  it('start through their Nx target when Playwright runs by hand', () => {
    expect(
      nxServer('korbjaeger:emulatoren', 'http://127.0.0.1:9199', OPTIONEN, {})
    ).toEqual({
      command: 'npx nx run korbjaeger:emulatoren',
      url: 'http://127.0.0.1:9199',
      reuseExistingServer: true,
      ...OPTIONEN,
    });
  });

  it('are only waited for inside an Nx task, which starts them itself', () => {
    expect(
      nxServer('korbjaeger:emulatoren', 'http://127.0.0.1:9199', OPTIONEN, {
        NX_TASK_TARGET_PROJECT: 'korbjaeger',
      }).command
    ).toBe(
      'node apps/korbjaeger/e2e/server/abwarten.mjs http://127.0.0.1:9199 2000'
    );
  });

  describe('waiting', () => {
    let server: Server | undefined;
    afterEach(() => server?.close());

    /** Runs the waiting command; resolves with its first output and whether it still runs. */
    function abwarten(url: string, timeoutMs: number) {
      const prozess = spawn(
        'node',
        ['apps/korbjaeger/e2e/server/abwarten.mjs', url, String(timeoutMs)],
        { cwd: WORKSPACE }
      );
      return new Promise<{ ausgabe: string; code: number | null }>((weiter) => {
        let ausgabe = '';
        prozess.stdout.on('data', (teil) => {
          ausgabe += String(teil);
          // it stays up once the server answered: Playwright ends it
          setTimeout(() => {
            weiter({ ausgabe, code: prozess.exitCode });
            prozess.kill();
          }, 300);
        });
        prozess.stderr.on('data', (teil) => (ausgabe += String(teil)));
        prozess.on('exit', (code) => weiter({ ausgabe, code }));
      });
    }

    it('waits for a server that comes up late, and stays up', async () => {
      server = createServer((_, antwort) => antwort.end('ok'));
      server.listen(0);
      const { port } = server.address() as AddressInfo;
      server.close();
      setTimeout(() => server?.listen(port), 500);

      const { ausgabe, code } = await abwarten(
        `http://127.0.0.1:${port}`,
        5000
      );

      expect(ausgabe).toContain('is up');
      expect(code).toBeNull();
    });

    it('fails where no server answers in time', async () => {
      const { ausgabe, code } = await abwarten('http://127.0.0.1:9', 300);

      expect(code).toBe(1);
      expect(ausgabe).toContain('No server answered');
    });
  });
});
