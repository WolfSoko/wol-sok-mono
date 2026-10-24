/**
 * @jest-environment node
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Plays the golden replay twice with the bundled engine, in plain Node. */
const RUNNER = `
import { readFileSync } from 'node:fs';
import { parseReplay, playReplay, BALANCE_VERSION } from './engine.mjs';
const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const replay = parseReplay(raw);
replay.header.balanceVersion = BALANCE_VERSION;
const play = () => {
  const { players, outcome, ticks, checksum, samples } = playReplay(replay);
  return { players, outcome, ticks, checksum, samples };
};
process.stdout.write(JSON.stringify([play(), play()]));
`;

describe('the engine bundle in Node', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bacteria-engine-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('plays the same replay twice to the very same result', async () => {
    await build({
      entryPoints: [join(__dirname, 'engine.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: join(dir, 'engine.mjs'),
      logLevel: 'silent',
    });
    writeFileSync(join(dir, 'run.mjs'), RUNNER);

    const output = execFileSync(
      process.execPath,
      [join(dir, 'run.mjs'), join(__dirname, 'lib/state/golden-replay.json')],
      { encoding: 'utf8', cwd: dir }
    );
    const [first, second] = JSON.parse(output);

    expect(first.ticks).toBe(360);
    expect(first.samples).toHaveLength(6);
    expect(second).toEqual(first);
  }, 60_000);
});
