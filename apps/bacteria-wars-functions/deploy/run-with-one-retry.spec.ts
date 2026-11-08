import { RunOutcome, runWithOneRetry } from './run-with-one-retry';

function scripted(...outcomes: RunOutcome[]): {
  run: () => Promise<RunOutcome>;
  runs: () => number;
} {
  let calls = 0;
  return {
    run: async () => outcomes[calls++],
    runs: () => calls,
  };
}

describe('runWithOneRetry', () => {
  let pauses: number[];
  let lines: string[];
  const deps = () => ({
    pause: async (ms: number) => {
      pauses.push(ms);
    },
    log: (line: string) => lines.push(line),
  });

  beforeEach(() => {
    pauses = [];
    lines = [];
  });

  it('runs once and passes when the first attempt succeeds', async () => {
    const command = scripted({ code: 0 });

    await expect(runWithOneRetry(command.run, deps())).resolves.toBe(0);

    expect(command.runs()).toBe(1);
    expect(pauses).toEqual([]);
  });

  it('retries once after the pause and passes when the second attempt succeeds', async () => {
    const command = scripted({ code: 1 }, { code: 0 });

    await expect(runWithOneRetry(command.run, deps())).resolves.toBe(0);

    expect(command.runs()).toBe(2);
    expect(pauses).toEqual([30_000]);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^::warning::.*attempt 1 of 2 failed with exit code 1/
      )
    );
    expect(lines).toContainEqual(
      expect.stringMatching(/attempt 2 of 2 succeeded/)
    );
  });

  it("fails with the second attempt's code when both attempts fail", async () => {
    const command = scripted({ code: 1 }, { code: 3 });

    await expect(runWithOneRetry(command.run, deps())).resolves.toBe(3);

    expect(command.runs()).toBe(2);
    expect(lines).toContainEqual(
      expect.stringMatching(/^::error::.*both attempts failed.*exit code 3/)
    );
  });

  it('does not retry a run ended by a signal', async () => {
    const command = scripted({ code: null, signal: 'SIGTERM' });

    await expect(runWithOneRetry(command.run, deps())).resolves.toBe(128 + 15);

    expect(command.runs()).toBe(1);
    expect(pauses).toEqual([]);
  });

  it('takes a pause of its own', async () => {
    const command = scripted({ code: 1 }, { code: 0 });

    await runWithOneRetry(command.run, { ...deps(), pauseMs: 5 });

    expect(pauses).toEqual([5]);
  });
});
