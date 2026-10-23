import {
  humanForWeaponKey,
  sameColonyStats,
  toColonyStats,
} from './colony-stats';
import { createPlayer } from './state/player.model';

function players(bacteriaCount: number, x = 10) {
  return [
    createPlayer({
      id: 0,
      x,
      y: 10,
      color: [255, 100, 20, 255],
      name: 'You',
      isBot: false,
      maxSpeed: 100,
    }),
    createPlayer({
      id: 1,
      x: 200,
      y: 10,
      color: [20, 100, 255, 255],
      name: 'Computer',
      isBot: true,
      maxSpeed: 100,
    }),
  ].map((player) => ({ ...player, bacteriaCount }));
}

describe('sameColonyStats', () => {
  it('ignores what the scoreboard does not show - a moving crosshair', () => {
    expect(
      sameColonyStats(
        toColonyStats(players(50, 10)),
        toColonyStats(players(50, 90))
      )
    ).toBe(true);
  });

  it('notices a number that changed', () => {
    expect(
      sameColonyStats(toColonyStats(players(50)), toColonyStats(players(51)))
    ).toBe(false);
  });

  it('notices a colony more or less', () => {
    expect(
      sameColonyStats(
        toColonyStats(players(50)),
        toColonyStats(players(50).slice(1))
      )
    ).toBe(false);
  });
});

describe('the boost ring', () => {
  it('starts empty after a boost, however short the cooldown', () => {
    // A boss's boost: a 9.6 s cooldown where the balance has 12.
    const [colony] = toColonyStats([
      {
        ...createPlayer({ id: 0, color: [255, 100, 20, 255] }),
        boostCooldownSec: 9.6,
        boostCooldownFullSec: 9.6,
      },
    ]);

    expect(colony.boostCharge).toBe(0);
  });
});

describe('humanForWeaponKey', () => {
  const left = createPlayer({ id: 0 });
  const right = createPlayer({ id: 1 });

  it('hands E to the first human and the right Shift to the second', () => {
    expect(humanForWeaponKey([left, right], 'e', 'KeyE')).toBe(left);
    expect(humanForWeaponKey([left, right], 'E', 'KeyE')).toBe(left);
    expect(humanForWeaponKey([left, right], 'Shift', 'ShiftRight')).toBe(right);
  });

  it('gives both keys to a single human', () => {
    expect(humanForWeaponKey([left], 'Shift', 'ShiftRight')).toBe(left);
  });

  it('ignores the left Shift and every other key', () => {
    expect(humanForWeaponKey([left, right], 'Shift', 'ShiftLeft')).toBeNull();
    expect(humanForWeaponKey([left, right], ' ', 'Space')).toBeNull();
    expect(humanForWeaponKey([], 'e', 'KeyE')).toBeNull();
  });
});
