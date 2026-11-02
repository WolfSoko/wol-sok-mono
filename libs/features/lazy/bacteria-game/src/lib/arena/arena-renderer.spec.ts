import { ArenaRenderer, paintArenaBackground } from './arena-renderer';
import { arenaTheme } from './arena-theme';
import { LEVELS } from '../state/levels';
import { ActiveEffect, WEAPONS } from '../state/evolution';
import { MarkLayer, WeaponFx } from './weapon-fx';

/** A 2D context that records what is drawn and how it is blended. */
function recordingContext() {
  const drawn: { op: string; blend: string; args: unknown[] }[] = [];
  const gradient = { addColorStop: jest.fn() };
  const context = {
    globalCompositeOperation: 'source-over',
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    drawn,
    createRadialGradient: jest.fn(() => gradient),
    createLinearGradient: jest.fn(() => gradient),
    setTransform: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    clip: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
  } as Record<string, unknown> & { drawn: typeof drawn };
  for (const op of ['arc', 'ellipse', 'fill', 'stroke']) {
    context[op] = jest.fn((...args: unknown[]) =>
      drawn.push({
        op,
        blend: context['globalCompositeOperation'] as string,
        args,
      })
    );
  }
  return context;
}

function effectOf(weapon: ActiveEffect['weapon']): ActiveEffect {
  return {
    weapon,
    owner: 1,
    x: 40,
    y: 20,
    radius: 12,
    remainingSec: 2,
    durationSec: 4,
  };
}

describe('ArenaRenderer weapons', () => {
  const renderer = new ArenaRenderer(64, 32, () => 0.5, 1, 1);

  it('adds a layer of light over the frame, then blends as before', () => {
    const cx = recordingContext();
    const layer = new MarkLayer();
    layer.add('ring', 40, 20, 9, [255, 255, 255], 0.8).size = 2;

    renderer.drawWeaponMarks(
      cx as unknown as CanvasRenderingContext2D,
      layer,
      true
    );

    expect(cx.drawn.map(({ op, blend }) => [op, blend])).toEqual([
      ['arc', 'lighter'],
      ['stroke', 'lighter'],
    ]);
    expect(cx.drawn[0].args.slice(0, 3)).toEqual([40, 20, 9]);
    expect(cx['lineWidth']).toBe(2);
    expect(cx['globalCompositeOperation']).toBe('source-over');
  });

  it.each(WEAPONS.map(({ id }) => id))(
    'draws %s, fired and acting, with the Canvas 2D API',
    (weapon) => {
      const effects = new WeaponFx(1);
      effects.update({
        deltaTimeSec: 1 / 60,
        timeSec: 1,
        reducedMotion: false,
        weaponFires: [
          { playerId: 1, weapon, x: 40, y: 20, radius: 12, isBot: false },
        ],
        weaponEffects: [effectOf(weapon)],
        seatColors: new Map([[1, [255, 140, 0, 255]]]),
        particleBudget: 100,
      });
      const cx = recordingContext();
      const context = cx as unknown as CanvasRenderingContext2D;

      renderer.drawWeaponMarks(context, effects.ground, false);
      renderer.drawWeaponMarks(context, effects.over, false);
      renderer.drawWeaponMarks(context, effects.light, true);

      expect(cx.drawn.filter(({ op }) => op === 'fill').length).toBeGreaterThan(
        3
      );
      expect(cx.drawn.some(({ blend }) => blend === 'lighter')).toBe(true);
    }
  );

  it('shades the colonies under a toxin cloud and the ice, only there', () => {
    const effects = new WeaponFx(1);
    effects.update({
      deltaTimeSec: 1 / 60,
      timeSec: 1,
      reducedMotion: false,
      weaponFires: [],
      weaponEffects: [
        effectOf('toxin-bomb'),
        effectOf('cryo-pulse'),
        effectOf('agar-bloom'),
      ],
      seatColors: new Map([[1, [255, 140, 0, 255]]]),
      particleBudget: 100,
    });
    const cx = recordingContext();
    const layer = {
      width: 128,
      getContext: () => cx,
    } as unknown as HTMLCanvasElement;

    renderer.tintColonies(layer, effects.tints);

    // The toxin and the ice, each a circle over what is drawn already.
    expect(cx.drawn.filter(({ op }) => op === 'fill')).toHaveLength(2);
    expect(cx.drawn.every(({ blend }) => blend === 'source-atop')).toBe(true);
    // In arena cells on a layer twice as fine.
    expect(cx['setTransform']).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(cx['restore']).toHaveBeenCalled();
  });
});

const WIDTH = 64;
const HEIGHT = 32;

function paint(levelId: string): Uint8ClampedArray {
  return paintArenaBackground(
    new Uint8ClampedArray(WIDTH * HEIGHT * 4),
    WIDTH,
    HEIGHT,
    arenaTheme(levelId)
  );
}

function brightness(data: Uint8ClampedArray, x: number, y: number): number {
  const index = (y * WIDTH + x) * 4;
  return data[index] + data[index + 1] + data[index + 2];
}

describe('paintArenaBackground', () => {
  it.each(LEVELS.map((level) => [level.name, level.id] as const))(
    '%s paints an opaque floor with a bright frame',
    (_name, levelId) => {
      const data = paint(levelId);

      for (let i = 3; i < data.length; i += 4) {
        expect(data[i]).toBe(255);
      }
      // The outermost ring stands out from the floor just inside it.
      expect(brightness(data, 0, HEIGHT / 2)).toBeGreaterThan(
        brightness(data, 4, HEIGHT / 2) + 60
      );
      expect(brightness(data, WIDTH / 2, HEIGHT - 1)).toBeGreaterThan(
        brightness(data, WIDTH / 2, HEIGHT - 5) + 60
      );
    }
  );

  it('paints the same floor every time', () => {
    expect(paint('serpentine')).toEqual(paint('serpentine'));
  });

  it('gives every level a look of its own', () => {
    const borders = new Set(
      LEVELS.map((level) => arenaTheme(level.id).border.join(','))
    );

    expect(borders.size).toBe(LEVELS.length);
  });
});
