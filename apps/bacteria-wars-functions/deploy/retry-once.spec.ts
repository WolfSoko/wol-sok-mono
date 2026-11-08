import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const RUNNER = join(__dirname, 'retry-once.ts');

function runner(...command: string[]) {
  return spawnSync('npx', ['tsx', RUNNER, ...command], { encoding: 'utf8' });
}

describe('retry-once.ts', () => {
  it('refuses to run without a command', () => {
    const result = runner();

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage: retry-once.ts <command>');
  });

  it('runs the command with its arguments and passes its success on', () => {
    const result = runner(
      process.execPath,
      '-e',
      'console.log(process.argv[1])',
      'deployed'
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('deployed');
    expect(result.stdout).not.toContain('retrying');
  });
});
