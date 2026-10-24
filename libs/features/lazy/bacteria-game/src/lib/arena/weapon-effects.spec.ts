import {
  ActiveEffect,
  WeaponFire,
  WeaponId,
  WEAPONS,
} from '../state/evolution';
import {
  BURST_SEC,
  effectFade,
  MarkLayer,
  particleBudget,
  STRIKE_SEC,
  tintApplies,
  WeaponEffects,
  WeaponFrame,
  WeaponMark,
} from './weapon-effects';

const ORANGE = [255, 140, 0, 255];
const BLUE = [40, 120, 255, 255];
const SEATS = new Map<number, readonly number[]>([
  [1, ORANGE],
  [2, BLUE],
]);

function fire(weapon: WeaponId, isBot = false): WeaponFire {
  return { playerId: 1, weapon, x: 100, y: 60, radius: 18, isBot };
}

function effect(
  weapon: WeaponId,
  remainingSec = 2,
  durationSec = 4
): ActiveEffect {
  return {
    weapon,
    owner: 1,
    x: 100,
    y: 60,
    radius: 20,
    remainingSec,
    durationSec,
  };
}

/** A frame of 1/60 s, nothing fired and nothing acting unless given. */
function frame(
  timeSec: number,
  changes: Partial<WeaponFrame> = {}
): WeaponFrame {
  return {
    deltaTimeSec: 1 / 60,
    timeSec,
    reducedMotion: false,
    weaponFires: [],
    weaponEffects: [],
    seatColors: SEATS,
    particleBudget: 200,
    ...changes,
  };
}

/** Runs frames of 1/60 s for that long, from `startSec`. */
function run(
  effects: WeaponEffects,
  seconds: number,
  startSec = 0,
  changes: Partial<WeaponFrame> = {}
): number {
  const frames = Math.round(seconds * 60);
  for (let i = 1; i <= frames; i++) {
    effects.update(frame(startSec + i / 60, changes));
  }
  return startSec + frames / 60;
}

function marks(layer: MarkLayer): WeaponMark[] {
  return Array.from({ length: layer.count }, (_, i) => layer.at(i));
}

function fields(effects: WeaponEffects): WeaponMark[] {
  return [effects.ground, effects.over, effects.light].flatMap((layer) =>
    layer.ofKind('field')
  );
}

describe('WeaponEffects', () => {
  it('bursts out where a weapon is fired: a flash, a shockwave and sparks', () => {
    const effects = new WeaponEffects(1);

    effects.update(frame(0, { weaponFires: [fire('toxin-bomb')] }));
    run(effects, 0.2);

    const rings = effects.light.ofKind('ring');
    expect(rings.length).toBeGreaterThan(0);
    expect(rings[0]).toMatchObject({ x: 100, y: 60 });
    // Running out past the circle as the burst goes on.
    expect(Math.max(...rings.map((ring) => ring.radius))).toBeGreaterThan(9);
    expect(effects.light.ofKind('glow').length).toBeGreaterThan(0);
    expect(effects.particleCount).toBeGreaterThan(5);
  });

  it('lets the burst die away', () => {
    const effects = new WeaponEffects(1);

    effects.update(frame(0, { weaponFires: [fire('agar-bloom')] }));
    run(effects, BURST_SEC + 1);

    expect(effects.visible).toBe(false);
    expect(effects.particleCount).toBe(0);
  });

  it.each(
    WEAPONS.filter((weapon) => weapon.durationSec > 0).map(({ id }) => id)
  )('draws %s over its circle while it acts', (weapon) => {
    const effects = new WeaponEffects(1);

    effects.update(frame(1, { weaponEffects: [effect(weapon)] }));

    const [field] = fields(effects);
    expect(field).toMatchObject({ weapon, x: 100, y: 60 });
    expect(field.alpha).toBeGreaterThan(0);
  });

  it('lays the bloom under the colonies and the cloud, ice and membrane over them', () => {
    const effects = new WeaponEffects(1);

    effects.update(
      frame(1, {
        weaponEffects: [
          effect('agar-bloom'),
          effect('toxin-bomb'),
          effect('cryo-pulse'),
          effect('biofilm-shield'),
        ],
      })
    );

    expect(effects.ground.ofKind('field').map((mark) => mark.weapon)).toEqual([
      'agar-bloom',
    ]);
    expect(effects.over.ofKind('field').map((mark) => mark.weapon)).toEqual([
      'toxin-bomb',
      'cryo-pulse',
      'biofilm-shield',
    ]);
    // Petals of the bloom and crystals of the ice.
    expect(effects.ground.ofKind('ellipse').length).toBeGreaterThanOrEqual(14);
    expect(effects.over.ofKind('ellipse').length).toBeGreaterThan(10);
  });

  it("draws the shield in its owner's colour", () => {
    const effects = new WeaponEffects(1);

    effects.update(frame(1, { weaponEffects: [effect('biofilm-shield')] }));

    const [membrane] = effects.over.ofKind('field');
    expect(membrane.color).toEqual(ORANGE.slice(0, 3));
  });

  it('fades an effect in as it starts and out as it ends', () => {
    expect(effectFade(effect('toxin-bomb', 4, 4))).toBe(0);
    expect(effectFade(effect('toxin-bomb', 3.9, 4))).toBeCloseTo(1 / 3);
    expect(effectFade(effect('toxin-bomb', 2, 4))).toBe(1);
    expect(effectFade(effect('toxin-bomb', 0.3, 4))).toBeCloseTo(0.5);
    expect(effectFade(effect('toxin-bomb', 0, 4))).toBe(0);
    // A strike acts for a frame, at full strength.
    expect(effectFade(effect('phage-strike', 0, 0))).toBe(1);

    const effects = new WeaponEffects(1);
    effects.update(frame(1, { weaponEffects: [effect('cryo-pulse', 2, 3.5)] }));
    const full = fields(effects)[0].alpha;
    effects.update(
      frame(2, { weaponEffects: [effect('cryo-pulse', 0.15, 3.5)] })
    );
    expect(fields(effects)[0].alpha).toBeLessThan(full / 2);
  });

  it('keeps a phage strike in view for about a second after the frame it acts in', () => {
    const effects = new WeaponEffects(1);
    const strike = effect('phage-strike', 0, 0);

    effects.update(
      frame(0, {
        weaponFires: [fire('phage-strike')],
        weaponEffects: [strike],
      })
    );
    // The strike fired and the strike acting are the same one.
    expect(effects.light.ofKind('field')).toHaveLength(1);
    // A white-hot flash right away.
    expect(effects.light.ofKind('glow')[0].alpha).toBeGreaterThan(0.9);

    let time = run(effects, 0.15);
    // The phages fly in.
    expect(effects.light.ofKind('hex').length).toBeGreaterThan(5);

    time = run(effects, 0.55, time);
    expect(effects.light.ofKind('field')).toHaveLength(1);
    const late = effects.light.ofKind('field')[0];
    expect(late.weapon).toBe('phage-strike');
    expect(late.color2).toEqual(ORANGE.slice(0, 3));

    run(effects, STRIKE_SEC + 0.5 - 0.7, time);
    expect(effects.light.ofKind('field')).toHaveLength(0);
  });

  it('strikes once for a strike that only shows as an effect', () => {
    const effects = new WeaponEffects(1);

    effects.update(frame(0, { weaponEffects: [effect('phage-strike', 0, 0)] }));
    effects.update(
      frame(1 / 60, { weaponEffects: [effect('phage-strike', 0, 0)] })
    );

    expect(effects.light.ofKind('field')).toHaveLength(1);
  });

  it('never flies more particles than the budget allows', () => {
    const effects = new WeaponEffects(1);
    const everything = WEAPONS.map(({ id }) => fire(id));

    effects.update(frame(0, { weaponFires: everything, particleBudget: 40 }));
    run(effects, 1, 0, {
      particleBudget: 40,
      weaponEffects: [effect('toxin-bomb'), effect('agar-bloom')],
    });

    expect(effects.particleCount).toBeLessThanOrEqual(40);
    expect(effects.particleCount).toBeGreaterThan(0);
  });

  it('takes a spent particle again before the pool grows', () => {
    const effects = new WeaponEffects(1);
    const pool = (effects as unknown as { particles: unknown[] }).particles;
    effects.update(frame(0, { weaponFires: [fire('toxin-bomb')] }));
    const first = pool.length;
    expect(first).toBeGreaterThan(0);

    // Long enough for every particle of the burst to have died.
    let timeSec = run(effects, 3);
    expect(effects.particleCount).toBe(0);
    for (let shot = 0; shot < 3; shot++) {
      effects.update(frame(timeSec, { weaponFires: [fire('toxin-bomb')] }));
      timeSec = run(effects, 3, timeSec);
    }

    expect(pool.length).toBe(first);
  });

  it('flies fewer particles for players who asked for less motion', () => {
    expect(particleBudget('medium', true)).toBeLessThan(
      particleBudget('medium', false) / 2
    );
    expect(particleBudget('low', false)).toBeLessThan(
      particleBudget('full-hd', false)
    );
  });

  it('shades the enemy with toxin and ice, and only the owner with a shield or a bloom', () => {
    const effects = new WeaponEffects(1);

    effects.update(
      frame(1, {
        weaponEffects: [
          effect('toxin-bomb'),
          effect('cryo-pulse'),
          effect('biofilm-shield'),
          effect('agar-bloom'),
        ],
      })
    );

    const shading = (color: readonly number[]) =>
      effects.tints
        .filter((tint) => tintApplies(tint, color))
        .map((tint) => tint.mode);
    expect(shading(BLUE)).toEqual(['toxin', 'cryo']);
    expect(shading(ORANGE)).toEqual(['shield', 'bloom']);
  });

  it('draws with a random of its own, never the one the war runs on', () => {
    const random = jest.spyOn(Math, 'random');
    const effects = new WeaponEffects(1);

    effects.update(
      frame(0, { weaponFires: WEAPONS.map(({ id }) => fire(id)) })
    );
    run(effects, 0.5, 0, {
      weaponEffects: WEAPONS.map(({ id }) => effect(id)),
    });

    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('lets go of everything on a reset', () => {
    const effects = new WeaponEffects(1);
    effects.update(frame(0, { weaponFires: [fire('phage-strike')] }));

    effects.reset();
    effects.update(frame(1 / 60));

    expect(effects.visible).toBe(false);
    expect(marks(effects.light)).toEqual([]);
  });
});
