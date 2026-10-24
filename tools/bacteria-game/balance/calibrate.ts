/**
 * Calibrates the difficulty curve (ADR 0016) from a lab report: moves each
 * level's skill in `SKILL` (`difficulty-curve.ts`) by how far the stand-in's
 * score sat from the target - more skill where it won too often - and
 * where the skill would leave its band on normal, the level's `STRENGTH`
 * (the computer's DNA budget) takes the rest. Prints both tables to paste
 * over the old ones.
 *
 *   tsx tools/bacteria-game/balance/run.ts full --gain-seeds 0
 *   tsx tools/bacteria-game/balance/calibrate.ts [dist/balance/balance-report.json]
 *
 * Repeat until the curve holds, then take a new baseline with
 * `run.ts full --update` and raise `LADDER_VERSION`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BalanceReport } from '../../../libs/features/lazy/bacteria-game/src/lib/state/balance/report';
import { cellKey } from '../../../libs/features/lazy/bacteria-game/src/lib/state/balance/report';
import { BOT_DIFFICULTIES } from '../../../libs/features/lazy/bacteria-game/src/lib/state/bot-controller';
import {
  SKILL,
  strengthOf,
  targetWinRate,
} from '../../../libs/features/lazy/bacteria-game/src/lib/state/difficulty-curve';
import { LEVELS } from '../../../libs/features/lazy/bacteria-game/src/lib/state/levels';

/** Skill moved per point of win rate off the target. */
const STEP = Number(process.env['CALIBRATION_STEP'] ?? 1.2);

const path = resolve(process.argv[2] ?? 'dist/balance/balance-report.json');
const report = JSON.parse(readFileSync(path, 'utf8')) as BalanceReport;

/** Times its budget per point the skill would have had to go past its band. */
const STRENGTH_STEP = Number(process.env['STRENGTH_STEP'] ?? 0.8);

const round = (value: number) => Math.round(value * 100) / 100;
const lines: string[] = [];
const strengths: string[] = [];
for (const { id: levelId } of LEVELS) {
  // Past the band on normal, the rest of the way goes to the level's
  // strength - the budget - which every difficulty shares.
  let beyond = 0;
  const skills = BOT_DIFFICULTIES.map(({ id: difficulty }, column) => {
    const skill = SKILL[levelId]?.[column] ?? 0;
    const stats =
      report.cells[cellKey({ levelId, difficulty, loadout: 'expected' })];
    if (stats === undefined) {
      return skill;
    }
    const off = stats.score - targetWinRate(levelId, difficulty);
    const wanted = skill + off * STEP;
    if (difficulty === 'normal') {
      beyond = wanted < 0 ? wanted : wanted > 1 ? wanted - 1 : 0;
    }
    return round(Math.min(1, Math.max(0, wanted)));
  });
  const key = /^[a-z]+$/.test(levelId) ? levelId : `'${levelId}'`;
  lines.push(`  ${key}: [${skills.join(', ')}],`);
  const strength = round(
    Math.min(
      2,
      Math.max(0.2, strengthOf(levelId) * (1 + beyond * STRENGTH_STEP))
    )
  );
  if (strength !== 1) {
    strengths.push(`  ${key}: ${strength},`);
  }
}
console.log(['export const SKILL = {', ...lines, '};'].join('\n'));
console.log(['export const STRENGTH = {', ...strengths, '};'].join('\n'));
