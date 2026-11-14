import type { Game } from '@wolsok/feat-shared-basketball-data';
import { followedSide } from './followed-club';

const GAME = {
  home: { kind: 'team', team: { id: 1, name: 'Heim', clubId: 10 } },
  away: { kind: 'team', team: { id: 2, name: 'Gast', clubId: 20 } },
} as unknown as Game;

describe('followedSide', () => {
  it('names the Team of the side whose Team is followed, the home side where both are', () => {
    expect(followedSide(GAME, [2])?.name).toBe('Gast');
    expect(followedSide(GAME, [2, 1])?.name).toBe('Heim');
  });

  it('names none where no side is followed, or Meine Teams are not read', () => {
    expect(followedSide(GAME, [3])).toBeUndefined();
    expect(followedSide(GAME, undefined)).toBeUndefined();
  });

  it('skips a side the Liga fills later', () => {
    const openSide = {
      ...GAME,
      home: { kind: 'open', label: 'Nord 1. Platz' },
    } as unknown as Game;

    expect(followedSide(openSide, [1, 2])?.name).toBe('Gast');
  });
});
