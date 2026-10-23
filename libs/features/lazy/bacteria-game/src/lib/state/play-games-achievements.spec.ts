import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ACHIEVEMENT_IDS } from './achievement-ids';
import { ACHIEVEMENTS } from './achievements';

/**
 * The achievements as the Android app lists them on Play Games Services
 * (tools/bacteria-game/play-games.ts syncs the file on every release).
 */
const PLAY_GAMES_FILE = resolve(
  __dirname,
  '../../../../../../../apps/bacteria-wars-android/store/play-games/achievements.json'
);

interface PlayText {
  name: string;
  description: string;
}

type PlayAchievements = Record<
  string,
  { points: number; 'en-US': PlayText; 'de-DE': PlayText }
>;

describe('the achievements on Play Games Services', () => {
  const onPlay = JSON.parse(
    readFileSync(PLAY_GAMES_FILE, 'utf8')
  ) as PlayAchievements;

  it('lists every achievement of the game, in the game’s order', () => {
    expect(Object.keys(onPlay)).toEqual([...ACHIEVEMENT_IDS]);
  });

  it('says in English what the game says', () => {
    for (const { id, name, condition } of ACHIEVEMENTS) {
      expect(onPlay[id]['en-US']).toEqual({ name, description: condition });
    }
  });

  it('has a German text for each', () => {
    for (const id of ACHIEVEMENT_IDS) {
      const { name, description } = onPlay[id]['de-DE'];
      expect(name.trim()).not.toBe('');
      expect(description.trim()).not.toBe('');
    }
  });
});
