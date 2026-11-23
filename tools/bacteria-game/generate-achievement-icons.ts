/**
 * Renders the Play Games Services icon of every achievement of Bacteria
 * Wars to PNG. The pictures themselves are `achievementIconSvg` of
 * `@wolsok/feat-shared-bacteria-art`, the same ones the game shows.
 *
 * Output: apps/bacteria-wars-android/store/play-games/achievements/<id>.png,
 * 512 x 512, one per achievement of the game (see play-games.ts). The
 * Publishing API takes no icons any more, so they go up by hand in Play
 * Console; keep the files committed, so a changed icon shows in the diff.
 *
 * Run with `npx nx run bacteria-wars-android:achievement-icons`.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  ACHIEVEMENT_ICON_SIZE,
  achievementIconSvg,
} from '@wolsok/feat-shared-bacteria-art';
import { render, svgPage } from '../icons/render-icons';
import { playGamesAchievements } from './play-games';

const outDir = resolve(
  'apps/bacteria-wars-android/store/play-games/achievements'
);

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const { id } of playGamesAchievements()) {
      const html = svgPage(achievementIconSvg(id), ACHIEVEMENT_ICON_SIZE);
      const png = await render(
        page,
        html,
        ACHIEVEMENT_ICON_SIZE,
        ACHIEVEMENT_ICON_SIZE,
        true
      );
      await writeFile(join(outDir, `${id}.png`), png);
      console.log(`${id}.png`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
