import { sameColonyStats, toColonyStats } from './colony-stats';
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

describe('the weapon ring', () => {
  const base = createPlayer({ id: 0, color: [255, 100, 20, 255] });

  it('is none for a colony without a weapon', () => {
    expect(toColonyStats([base])[0].weapon).toBeNull();
  });

  it('counts the recharge of the weapon carried', () => {
    const [colony] = toColonyStats([
      {
        ...base,
        weapon: 'cryo-pulse',
        weaponCooldownSec: 15,
        weaponCooldownFullSec: 20,
        weaponActiveSec: 2,
      },
    ]);

    expect(colony.weapon).toEqual({
      id: 'cryo-pulse',
      ready: false,
      active: true,
      cooldown: 15,
      charge: 0.25,
    });
  });

  it('is full and ready once it has recharged, and noticed when it changes', () => {
    const ready = toColonyStats([{ ...base, weapon: 'toxin-bomb' }]);
    const fired = toColonyStats([
      {
        ...base,
        weapon: 'toxin-bomb',
        weaponCooldownSec: 18,
        weaponCooldownFullSec: 18,
      },
    ]);

    expect(ready[0].weapon).toMatchObject({ ready: true, charge: 1 });
    expect(sameColonyStats(ready, fired)).toBe(false);
    expect(
      sameColonyStats(ready, toColonyStats([{ ...base, weapon: 'toxin-bomb' }]))
    ).toBe(true);
  });
});
