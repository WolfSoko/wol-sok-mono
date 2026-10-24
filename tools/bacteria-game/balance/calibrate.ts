/**
 * Calibrates the difficulty curve (ADR 0014) from a lab report: moves each
 * level's skill in `SKILL` (`difficulty-curve.ts`) by how far the stand-in's
 * win rate sat from the target - more skill where it won too often - and
 * prints the new table to paste over the old one.
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
  targetWinRate,
} from '../../../libs/features/lazy/bacteria-game/src/lib/state/difficulty-curve';
import { LEVELS } from '../../../libs/features/lazy/bacteria-game/src/lib/state/levels';

/** Skill moved per point of win rate off the target. */
const STEP = Number(process.env['CALIBRATION_STEP'] ?? 1.2);

const path = resolve(process.argv[2] ?? 'dist/balance/balance-report.json');
const report = JSON.parse(readFileSync(path, 'utf8')) as BalanceReport;

const lines: string[] = [];
for (const { id: levelId } of LEVELS) {
  const skills = BOT_DIFFICULTIES.map(({ id: difficulty }, column) => {
    const skill = SKILL[levelId]?.[column] ?? 0;
    const stats =
      report.cells[cellKey({ levelId, difficulty, loadout: 'expected' })];
    if (stats === undefined) {
      return skill;
    }
    const off = stats.winRate - targetWinRate(levelId, difficulty);
    return Math.round(Math.min(1, Math.max(0, skill + off * STEP)) * 100) / 100;
  });
  const key = /^[a-z]+$/.test(levelId) ? levelId : `'${levelId}'`;
  lines.push(`  ${key}: [${skills.join(', ')}],`);
}
console.log(['export const SKILL = {', ...lines, '};'].join('\n'));
