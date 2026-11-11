import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUNNER = join(__dirname, 'retry-once.ts');

/** Runs the runner as the deploy target does, without the 30 s pause. */
function runner(...command: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', RUNNER, ...command], {
    encoding: 'utf8',
    env: { ...process.env, RETRY_PAUSE_MS: '0' },
  });
}

function nodeScript(source: string): string[] {
  return [process.execPath, '-e', source];
}

describe('retry-once.ts', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'retry-once-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('refuses to run without a command', () => {
    const result = runner();

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage: retry-once.ts <command>');
  });

  it('runs the command with its arguments and passes its success on', () => {
    const result = runner(
      ...nodeScript('console.log(process.argv[1])'),
      'deployed'
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('deployed');
    expect(result.stdout).not.toContain('retrying');
  });

  it("exits with the second attempt's code when both fail", () => {
    const result = runner(...nodeScript('process.exit(5)'));

    expect(result.status).toBe(5);
    expect(result.stdout).toContain(
      'both attempts failed, the last with exit code 5'
    );
  });

  it('does not retry a command ended by a signal', () => {
    const result = runner(
      ...nodeScript("process.kill(process.pid, 'SIGTERM')")
    );

    expect(result.status).toBe(128 + 15);
    expect(result.stdout).not.toContain('retrying');
  });

  it('does not retry a command that cannot start', () => {
    const result = runner(join(dir, 'no-such-command'));

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('could not start');
    expect(result.stdout).not.toContain('retrying');
  });
});
