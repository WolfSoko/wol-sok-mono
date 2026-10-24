/**
 * The balance lab of Bacteria Wars (ADR 0016): plays the stand-in for a
 * human against the computer on every level, difficulty and loadout of the
 * matrix on the CPU engine, and writes `balance-report.json`.
 *
 *   tsx tools/bacteria-game/balance/run.ts check [--levels a,b]
 *     The short check: the expected loadout on normal, a few seeds, the
 *     first 90 s - compared with the committed baseline. Fails on drift.
 *   tsx tools/bacteria-game/balance/run.ts full [--levels a,b] [--update]
 *     The full matrix, summed up, checked and compared with the baseline:
 *     writes the report, `summary.md` and `status.json` to `--out-dir`
 *     (`dist/balance`), and with `--update` the report over the baseline.
 *   tsx tools/bacteria-game/balance/run.ts full --shard 2/6 --raw part.json
 *     A share of the full matrix, its matches unsummed - for the nightly
 *     workflow's jobs; `merge part-*.json` sums them up as `full` does.
 *
 * `--jobs n` plays on n processes (all cores by default); `--journal
 * file.jsonl` keeps each match as it is played, so a run that was cut off
 * goes on where it stopped.
 */
import { ChildProcess, execFileSync, fork } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { LabMatch } from '../../../libs/features/lazy/bacteria-game/src/lib/state/balance/lab-match';
import {
  BalanceReport,
  checkDrift,
  checkMatrix,
  curveTable,
  drift,
  findings,
  FULL_RUN,
  fullMatrix,
  gainsOf,
  LabConfig,
  medalTable,
  NamedCell,
  summarize,
} from '../../../libs/features/lazy/bacteria-game/src/lib/state/balance/report';
import { LEVELS } from '../../../libs/features/lazy/bacteria-game/src/lib/state/levels';
import type { WorkerResult } from './worker';

/** The workspace, where Nx runs the targets from. */
const ROOT = process.cwd();
/** The committed baseline. */
export const BASELINE = resolve(
  ROOT,
  'libs/features/lazy/bacteria-game/src/lib/state/balance/balance-report.json'
);

interface Played {
  cell: NamedCell;
  match: LabMatch;
}

interface Raw {
  played: Played[];
  checked: Played[];
}

/** An option's value, given as `--name value` or `--name=value` (as Nx forwards it). */
function option(name: string): string | undefined {
  const args = process.argv;
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline !== undefined) {
    return inline.slice(name.length + 3);
  }
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
}

function flag(name: string): boolean {
  return process.argv.some(
    (arg) => arg === `--${name}` || arg === `--${name}=true`
  );
}

/** The levels asked for - every one when none are. */
function levelIds(): string[] {
  const asked = option('levels')?.split(',').filter(Boolean);
  if (asked === undefined) {
    return LEVELS.map(({ id }) => id);
  }
  const unknown = asked.filter(
    (id) => !LEVELS.some((level) => level.id === id)
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown levels: ${unknown.join(', ')}`);
  }
  return asked;
}

/**
 * The full run's setup, as `--curve-seeds`, `--gain-seeds` and `--horizon`
 * change it for a quick look - the baseline takes {@link FULL_RUN}.
 */
function configOf(): LabConfig {
  const number = (name: string, fallback: number) => {
    const value = option(name);
    return value === undefined ? fallback : Number(value);
  };
  return {
    ...FULL_RUN,
    curveSeeds:
      option('curve-seeds') === undefined
        ? FULL_RUN.curveSeeds
        : {
            easy: number('curve-seeds', 0),
            normal: number('curve-seeds', 0),
            hard: number('curve-seeds', 0),
          },
    bigMapSeeds:
      option('curve-seeds') === undefined
        ? FULL_RUN.bigMapSeeds
        : {
            easy: number('curve-seeds', 0),
            normal: number('curve-seeds', 0),
            hard: number('curve-seeds', 0),
          },
    gainSeeds: number('gain-seeds', FULL_RUN.gainSeeds),
    horizonSec: number('horizon', FULL_RUN.horizonSec),
    checkSeeds: number('check-seeds', FULL_RUN.checkSeeds),
  };
}

/** The share of the cells this process plays: every n-th from the i-th. */
function shardOf<T>(cells: readonly T[]): T[] {
  const shard = option('shard');
  if (shard === undefined) {
    return [...cells];
  }
  const [index, count] = shard.split('/').map(Number);
  return cells.filter((_, n) => n % count === index - 1);
}

/** The workers playing - stopped with the runner, mid-match or not. */
const workers = new Set<ChildProcess>();
process.on('exit', () => workers.forEach((worker) => worker.kill()));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => process.exit(130));
}

/** Plays cells on worker processes, slowest first, in their order back. */
export async function play(cells: readonly NamedCell[]): Promise<Played[]> {
  const results: (LabMatch | undefined)[] = new Array(cells.length);
  // A journal keeps every match as it is played: a run cut off goes on
  // where it stopped.
  const journalPath = option('journal');
  const journal = journalPath === undefined ? null : resolve(ROOT, journalPath);
  const kept =
    journal === null ? new Map<string, Played>() : readJournal(journal);
  cells.forEach((cell, index) => {
    results[index] = kept.get(JSON.stringify(cell))?.match;
  });
  // The big maps take longest: start them first, so no worker idles at the end.
  const order = cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ index }) => results[index] === undefined)
    .sort((a, b) => weight(b.cell) - weight(a.cell));
  const jobs = Math.max(
    1,
    Math.min(order.length, Number(option('jobs') ?? availableParallelism()))
  );
  if (order.length < cells.length) {
    console.log(`  ${cells.length - order.length} matches from the journal`);
  }
  let next = 0;
  let done = 0;
  const started = Date.now();
  await Promise.all(
    Array.from(
      { length: jobs },
      () =>
        new Promise<void>((resolveWorker, reject) => {
          const worker = fork(
            resolve(ROOT, 'tools/bacteria-game/balance/worker.ts'),
            [],
            {
              execArgv: ['--import', 'tsx'],
            }
          );
          workers.add(worker);
          worker.on('exit', () => workers.delete(worker));
          const feed = () => {
            const job = order[next++];
            if (job === undefined) {
              worker.send('done');
              return;
            }
            worker.send({ index: job.index, cell: job.cell });
          };
          worker.on('message', ({ index, match }: WorkerResult) => {
            results[index] = match;
            if (journal !== null) {
              appendFileSync(
                journal,
                `${JSON.stringify({ cell: cells[index], match })}\n`
              );
            }
            done++;
            if (done % 10 === 0 || done === order.length) {
              const minutes = ((Date.now() - started) / 60000).toFixed(1);
              console.log(`  ${done}/${order.length} matches, ${minutes} min`);
            }
            feed();
          });
          worker.on('error', reject);
          worker.on('exit', (code) =>
            code === 0
              ? resolveWorker()
              : reject(new Error(`worker exited ${code}`))
          );
          feed();
        })
    )
  );
  return cells.map((cell, index) => {
    const match = results[index];
    if (match === undefined) {
      throw new Error(`no result for ${cell.levelId}`);
    }
    return { cell, match };
  });
}

/** The matches a journal holds, by their cell. */
function readJournal(path: string): Map<string, Played> {
  const kept = new Map<string, Played>();
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    return kept;
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() !== '') {
      const played = JSON.parse(line) as Played;
      kept.set(JSON.stringify(played.cell), played);
    }
  }
  return kept;
}

/** Roughly what a cell costs: a big map's ticks cost its area. */
function weight(cell: NamedCell): number {
  const index = LEVELS.findIndex(({ id }) => id === cell.levelId);
  return cell.horizonSec * (index >= LEVELS.length - 5 ? 4 : 1);
}

function readReport(path: string): BalanceReport | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BalanceReport;
  } catch {
    return null;
  }
}

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** The report's text: stable, so a new baseline's diff shows what moved. */
function reportText(report: BalanceReport): string {
  return `${JSON.stringify(report, null, 1)}\n`;
}

/**
 * Sums up a full run, checks it, compares it with the baseline and writes
 * it all out. Returns whether it passed.
 */
function finish(config: LabConfig, raw: Raw): boolean {
  const report = summarize(config, raw.played, raw.checked);
  const baseline = readReport(BASELINE);
  const found = findings(report);
  // A run of some levels only is compared on those.
  const moved =
    baseline === null ? ['no baseline yet'] : drift(baseline, report);
  const outDir = resolve(ROOT, option('out-dir') ?? 'dist/balance');
  write(resolve(outDir, 'balance-report.json'), reportText(report));
  write(
    resolve(outDir, 'status.json'),
    `${JSON.stringify({ findings: found, drift: moved }, null, 2)}\n`
  );
  write(resolve(outDir, 'summary.md'), summary(report, found, moved));
  if (flag('update')) {
    // Only a whole run of the full setup makes a baseline.
    if (
      JSON.stringify(config) !== JSON.stringify(FULL_RUN) ||
      option('levels') !== undefined
    ) {
      throw new Error('--update takes the full run on every level only.');
    }
    write(BASELINE, reportText(report));
    // In the workspace's format, so the next baseline's diff shows only
    // what moved.
    execFileSync('npx', ['oxfmt', BASELINE], { cwd: ROOT, stdio: 'inherit' });
    console.log(`Baseline written: ${BASELINE}`);
  }
  console.log(summary(report, found, moved));
  return found.length === 0 && moved.length === 0;
}

/** The run in Markdown - the nightly issue's body. */
function summary(
  report: BalanceReport,
  found: readonly string[],
  moved: readonly string[]
): string {
  const list = (lines: readonly string[]) =>
    lines.length === 0 ? ['None.'] : lines.map((line) => `- ${line}`);
  const levels = LEVELS.map(({ id }) => id).filter(
    (id) => Object.keys(gainsOf(report, id)).length > 0
  );
  const gains = levels.map((id) => {
    const values = gainsOf(report, id);
    return `| ${id} | ${Object.values(values)
      .map((gain) => gain.toFixed(1))
      .join(' | ')} |`;
  });
  const header =
    levels.length === 0 ? [] : Object.keys(gainsOf(report, levels[0]));
  return [
    `# Balance lab (BALANCE_VERSION ${report.balanceVersion})`,
    '',
    '## Failed checks',
    ...list(found),
    '',
    '## Drift from the baseline',
    ...list(moved),
    '',
    '## Score of the stand-in with the expected loadout - wins, undecided as half (target)',
    ...curveTable(report),
    '',
    "## Medallion limits: the level's → measured (normal, expected loadout)",
    ...medalTable(report),
    '',
    '## Gain in points of share against plain, on normal',
    ...(header.length === 0
      ? ['None measured.']
      : [
          `| Level | ${header.join(' | ')} |`,
          `| --- | ${header.map(() => '---').join(' | ')} |`,
          ...gains,
        ]),
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const levels = levelIds();
  switch (command) {
    case 'check': {
      const baseline = readReport(BASELINE);
      if (baseline === null) {
        throw new Error(
          `No baseline at ${BASELINE} - run "full --update" first.`
        );
      }
      const cells = checkMatrix(baseline.config, levels);
      console.log(
        `Short check: ${cells.length} matches of ${baseline.config.checkHorizonSec} s`
      );
      const checked = await play(cells);
      const run = summarize(baseline.config, [], checked);
      const moved = [
        ...(baseline.balanceVersion === run.balanceVersion
          ? []
          : [`BALANCE_VERSION moved: run "full --update" to re-baseline`]),
        ...checkDrift(baseline, run),
      ];
      if (moved.length > 0) {
        console.error(
          ['Balance drift:', ...moved.map((line) => `- ${line}`)].join('\n')
        );
        process.exitCode = 1;
      } else {
        console.log('No drift from the baseline.');
      }
      return;
    }
    case 'full': {
      const config = configOf();
      const played = shardOf(fullMatrix(config, levels));
      const checked = shardOf(checkMatrix(config, levels));
      console.log(
        `Full run: ${played.length} matches, ${checked.length} of the short check`
      );
      const raw: Raw = {
        played: await play(played),
        checked: await play(checked),
      };
      const rawPath = option('raw');
      if (rawPath !== undefined) {
        write(resolve(ROOT, rawPath), JSON.stringify(raw));
        return;
      }
      if (!finish(config, raw) && flag('strict')) {
        process.exitCode = 1;
      }
      return;
    }
    case 'merge': {
      const files = rest.filter(
        (arg) => !arg.startsWith('--') && /\.jsonl?$/.test(arg)
      );
      // A journal holds matches of the full run: the short check's cells
      // are the ones its horizon tells.
      const raws = files.map((file): Raw => {
        if (!file.endsWith('.jsonl')) {
          return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as Raw;
        }
        const played = [...readJournal(resolve(ROOT, file)).values()];
        return {
          played: played.filter(
            ({ cell }) => cell.horizonSec !== FULL_RUN.checkHorizonSec
          ),
          checked: played.filter(
            ({ cell }) => cell.horizonSec === FULL_RUN.checkHorizonSec
          ),
        };
      });
      const raw: Raw = {
        played: raws.flatMap(({ played }) => played),
        checked: raws.flatMap(({ checked }) => checked),
      };
      if (!finish(configOf(), raw) && flag('strict')) {
        process.exitCode = 1;
      }
      return;
    }
    default:
      console.error(
        'Usage: run.ts check|full|merge [--levels a,b] [--jobs n] [--update]'
      );
      process.exitCode = 2;
  }
}

// Run as a script, not when another script borrows `play`.
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
