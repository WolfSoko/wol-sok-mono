import { Cells, gameBalance } from '@wolsok/feat-shared-bacteria-engine';
import type { ArenaFrame, PaintedColony } from '../arena-painter';
import { arenaTheme } from '../arena-theme';
import { ColonyTint, TINT_MODES, WHOLE_COLONY } from '../weapon-fx';
import { fakeGl, glConstant } from '../../gl/testing/fake-gl';
import {
  encodeCells,
  keepBox,
  GlArenaPainter,
  packTints,
  passMargins,
} from './gl-arena-painter';
import { MAX_TINTS } from './shaders';

describe('packTints', () => {
  const ORANGE = [255, 140, 0, 255];
  const BLUE = [40, 120, 255, 255];

  function tint(
    mode: ColonyTint['mode'],
    enemies: boolean,
    radius = 18
  ): ColonyTint {
    return {
      mode,
      x: 10,
      y: 20,
      radius,
      strength: 0.5,
      ownerColor: ORANGE,
      enemies,
    };
  }

  it('packs the tints that shade a colony for the colony shader', () => {
    const circles = new Float32Array(MAX_TINTS * 4);
    const modes = new Float32Array(4);
    const tints = [tint('toxin', true), tint('shield', false, WHOLE_COLONY)];

    // The enemy sickens in the cloud.
    expect(packTints(tints, BLUE, circles, modes)).toBe(1);
    expect(Array.from(circles.slice(0, 4))).toEqual([10, 20, 18, 0.5]);
    expect(modes[0]).toBe(TINT_MODES.indexOf('toxin'));

    // The owner wears its shield.
    expect(packTints(tints, ORANGE, circles, modes)).toBe(1);
    expect(circles[2]).toBe(WHOLE_COLONY);
    expect(modes[0]).toBe(TINT_MODES.indexOf('shield'));
  });

  it('packs no more tints than the shader takes', () => {
    const circles = new Float32Array(MAX_TINTS * 4);
    const modes = new Float32Array(4);
    const tints = Array.from({ length: MAX_TINTS + 3 }, () =>
      tint('cryo', true)
    );

    expect(packTints(tints, BLUE, circles, modes)).toBe(MAX_TINTS);
  });
});

describe('encodeCells', () => {
  const width = 8;
  const height = 4;
  const whole = [0, 0, width, height] as const;

  it('packs density and overcharge per cell', () => {
    const out = new Uint8Array(width * height * 2);

    encodeCells(
      out,
      width,
      Cells.of([
        { x: 1, y: 1, energy: gameBalance.maxEnergy },
        { x: 5, y: 2, energy: gameBalance.superChargedMaxEnergy },
        { x: 3, y: 3, energy: 0 },
      ]),
      gameBalance,
      whole
    );

    // Full strength, not overcharged.
    expect([out[(1 * width + 1) * 2], out[(1 * width + 1) * 2 + 1]]).toEqual([
      255, 0,
    ]);
    // Supercharged: full strength and full heat.
    expect([out[(2 * width + 5) * 2], out[(2 * width + 5) * 2 + 1]]).toEqual([
      255, 255,
    ]);
    // Out of energy - still a bacterium, at the lowest density.
    expect(out[(3 * width + 3) * 2]).toBe(Math.round(255 * 0.55));
    // Empty cells stay 0.
    expect(out[0]).toBe(0);
  });

  it('clears the last frame inside the box and leaves the rest alone', () => {
    const out = new Uint8Array(width * height * 2).fill(9);

    encodeCells(
      out,
      width,
      Cells.of([
        { x: 2, y: 1, energy: gameBalance.maxEnergy },
        { x: 6, y: 1, energy: gameBalance.maxEnergy },
      ]),
      gameBalance,
      [1, 1, 4, 3]
    );

    const byteAt = (x: number, y: number) => out[(y * width + x) * 2];
    expect(byteAt(2, 1)).toBe(255);
    expect([byteAt(1, 1), byteAt(3, 2)]).toEqual([0, 0]);
    // Outside the box: neither cleared nor packed.
    expect([byteAt(6, 1), byteAt(0, 0), byteAt(4, 1)]).toEqual([9, 9, 9]);
  });
});

describe('passMargins', () => {
  // The colony pass reads the vertical blur one cell further out than its
  // box, the vertical blur the horizontal one two rows, the horizontal blur
  // the cells two columns: each pass has to cover what the next one reads,
  // or the next one picks up the other colony's stale density.
  it.each([0, 3, 5, 10])(
    'lets every pass cover what the next one reads, at a reach of %i',
    (reach) => {
      const margin = passMargins(reach);

      expect(margin.verticalBlur).toBeGreaterThanOrEqual(margin.colony + 1);
      expect(margin.horizontalBlur).toBeGreaterThanOrEqual(
        margin.verticalBlur + 2
      );
      expect(margin.cells).toBeGreaterThanOrEqual(margin.horizontalBlur + 2);
    }
  );

  it('moves the whole chain out by the reach', () => {
    const near = passMargins(0);
    const far = passMargins(5);

    expect(far.colony).toBe(near.colony + 5);
    expect(far.cells).toBe(near.cells + 5);
  });
});

/** A GL painter of a 32×16 arena on a fake WebGL2 context, twice as many pixels. */
function painterOnFakeContext(width = 32, height = 16) {
  const fake = fakeGl();
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  jest
    .spyOn(canvas, 'getContext')
    .mockReturnValue(fake.gl as unknown as RenderingContext);
  const painter = GlArenaPainter.create(canvas, width, height, 2, 1);
  if (painter == null) {
    throw new Error('No painter on the fake context');
  }
  return { fake, canvas, painter };
}

describe('GlArenaPainter', () => {
  const DITHER = glConstant('DITHER');

  it('paints without dithering, so the trail and the targets hold what was drawn', () => {
    const { fake, painter } = painterOnFakeContext();

    expect(painter).not.toBeNull();
    expect(fake.callsOf('disable', DITHER)).toBe(1);
  });

  it('switches dithering off again in a restored context', () => {
    const { fake, canvas } = painterOnFakeContext();

    canvas.dispatchEvent(new Event('webglcontextlost'));
    canvas.dispatchEvent(new Event('webglcontextrestored'));

    expect(fake.callsOf('disable', DITHER)).toBe(2);
  });
});

describe('GlArenaPainter diagnostic', () => {
  const WIDTH = 32;
  const HEIGHT = 16;

  function painted() {
    const { fake, painter } = painterOnFakeContext(WIDTH, HEIGHT);
    painter.setFloor(arenaTheme('petri-dish'), []);
    return { fake, painter };
  }

  /** A colony drawn out of the GPU simulation's state. */
  const GPU_COLONY = {
    kind: 'state',
    look: 'slime',
    color: [255, 140, 0, 255],
    boostTarget: null,
    state: {},
    effects: {},
    owner: 1,
    bounds: { minX: 4, minY: 4, maxX: 10, maxY: 8 },
  } as unknown as PaintedColony;

  function frame(colonies: readonly PaintedColony[] = []): ArenaFrame {
    return {
      clear: false,
      deltaTimeSec: 1 / 60,
      timeSec: 1,
      view: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      walls: [],
      dynamicWalls: [],
      colonies,
      reducedMotion: false,
      nutrients: [],
      balance: gameBalance,
      cursors: [],
      weaponFires: [],
      weaponEffects: [],
      seatColors: new Map(),
      particleBudget: 0,
    };
  }

  it('never asks for GL errors while nobody diagnoses the painter', () => {
    const { fake, painter } = painted();

    painter.paint(frame([GPU_COLONY]));
    painter.showLastFrame();

    expect(fake.callsOf('getError')).toBe(0);
  });

  it('counts an error under the pass that raised it', () => {
    const { fake, painter } = painted();
    const diagnostics = painter.diagnose();
    // The floor's opacity is the first float uniform of a frame without colonies.
    fake.failOn('uniform1f', glConstant('INVALID_OPERATION'));

    painter.paint(frame());

    expect(diagnostics.errors()).toEqual([
      { pass: 'floor', error: 'INVALID_OPERATION', count: 1 },
    ]);
    expect(diagnostics.renderer).toBe('fake renderer');
  });

  /** The boxes set as `uBox`, in clip space, in the order they were set. */
  function boxesOf(fake: ReturnType<typeof painted>['fake']): number[][] {
    return (fake.calls.get('uniform4f') ?? [])
      .filter(([location]) => (location as { name: string }).name === 'uBox')
      .map(([, ...box]) => box as number[]);
  }

  it('draws the colony and its glow onto the frame as quads of their box, never scissored', () => {
    const { fake, painter } = painted();
    const SCISSOR_TEST = glConstant('SCISSOR_TEST');
    const scissoredBefore = fake.callsOf('enable', SCISSOR_TEST);

    painter.paint(frame([GPU_COLONY]));

    // Only the colony's passes on the arena grid are scissored.
    expect(fake.callsOf('enable', SCISSOR_TEST) - scissoredBefore).toBe(1);
    const [colony, glow] = boxesOf(fake);
    // Cells 4 to 10 and 4 to 8 of 32×16, on 64×32 pixels, row 0 at the bottom.
    const cells = [-0.75, -0.125, -0.3125, 0.5];
    expect(colony[0]).toBeLessThanOrEqual(cells[0]);
    expect(colony[1]).toBeLessThanOrEqual(cells[1]);
    expect(colony[2]).toBeGreaterThanOrEqual(cells[2]);
    expect(colony[3]).toBeGreaterThanOrEqual(cells[3]);
    expect(colony).not.toEqual([-1, -1, 1, 1]);
    // The glow reaches 4 cells out: cells 0 to 15 and 0 to 13.
    expect(glow).toEqual([-1, -0.625, -0.0625, 1]);
  });

  it('draws no glow for colonies all out of view', () => {
    const { fake, painter } = painted();
    const view = { x: 24, y: 0, width: 8, height: 4 };
    const drawsOf = (painting: ArenaFrame) => {
      const before = fake.callsOf('drawArrays');
      painter.paint(painting);
      return fake.callsOf('drawArrays') - before;
    };

    const withoutColonies = drawsOf({ ...frame(), view });

    expect(drawsOf({ ...frame([GPU_COLONY]), view })).toBe(withoutColonies);
    expect(boxesOf(fake)).toEqual([]);
  });

  it('asks for no GL errors once the diagnostic is stopped', () => {
    const { fake, painter } = painted();
    painter.diagnose().stop();
    const asked = fake.callsOf('getError');

    painter.paint(frame([GPU_COLONY]));

    expect(fake.callsOf('getError')).toBe(asked);
  });

  it("captures the trail, the glow and each colony's cells and density", () => {
    const { painter } = painted();
    painter.paint(frame([GPU_COLONY]));

    const layers = painter.diagnose().captureLayers();

    expect(
      layers.map(({ label, width, height, pixels }) => ({
        label,
        width,
        height,
        bytes: pixels.length,
      }))
    ).toEqual([
      { label: 'trail', width: 64, height: 32, bytes: 64 * 32 * 4 },
      { label: 'glow', width: 32, height: 16, bytes: 32 * 16 * 4 },
      { label: 'colony 1 cells', width: 32, height: 16, bytes: 32 * 16 * 4 },
      { label: 'colony 1 density', width: 32, height: 16, bytes: 32 * 16 * 4 },
    ]);
  });
});

describe('keepBox', () => {
  it('blacks out what lies outside the box', () => {
    const layer = {
      label: 'cells',
      width: 3,
      height: 2,
      pixels: new Uint8Array(3 * 2 * 4).fill(9),
    };

    keepBox(layer, [1, 0, 2, 1]);

    const kept = Array.from({ length: 6 }, (_, i) => layer.pixels[i * 4]);
    expect(kept).toEqual([0, 9, 0, 0, 0, 0]);
  });
});

describe('GlArenaPainter trail', () => {
  const WIDTH = 32;
  const HEIGHT = 16;
  const FRAMEBUFFER = glConstant('FRAMEBUFFER');
  const DRAW_FRAMEBUFFER = glConstant('DRAW_FRAMEBUFFER');
  const TEXTURE0 = glConstant('TEXTURE0');
  const BLEND = glConstant('BLEND');
  const TRACKED = [
    'activeTexture',
    'bindTexture',
    'bindFramebuffer',
    'framebufferTexture2D',
    'invalidateFramebuffer',
    'enable',
    'disable',
    'drawArrays',
    'drawArraysInstanced',
  ];

  /** One draw call and the GL state it ran with. */
  interface Draw {
    framebuffer: unknown;
    /** The texture bound to each unit's TEXTURE_2D. */
    units: ReadonlyMap<number, unknown>;
    blend: boolean;
  }

  /** What the painter's calls did, replayed in the order they were made. */
  interface Replay {
    draws: Draw[];
    /** The framebuffer bound when each frame target was invalidated. */
    frameTargets: unknown[];
    /** Each framebuffer's colour texture. */
    textureOf: ReadonlyMap<unknown, unknown>;
    /** How many draws had run when each frame target was invalidated. */
    frameStarts: number[];
  }

  function replay(fake: ReturnType<typeof fakeGl>): Replay {
    const methods = fake.gl as unknown as Record<string, jest.Mock>;
    const timeline = TRACKED.flatMap((name) =>
      methods[name].mock.calls.map((args, index) => ({
        name,
        args,
        order: methods[name].mock.invocationCallOrder[index],
      }))
    ).sort((a, b) => a.order - b.order);
    const units = new Map<number, unknown>();
    const textureOf = new Map<unknown, unknown>();
    const draws: Draw[] = [];
    const frameTargets: unknown[] = [];
    const frameStarts: number[] = [];
    let unit = 0;
    let framebuffer: unknown = null;
    let blend = false;
    for (const { name, args } of timeline) {
      switch (name) {
        case 'activeTexture':
          unit = (args[0] as number) - TEXTURE0;
          break;
        case 'bindTexture':
          units.set(unit, args[1]);
          break;
        case 'bindFramebuffer':
          if (args[0] === FRAMEBUFFER || args[0] === DRAW_FRAMEBUFFER) {
            framebuffer = args[1];
          }
          break;
        case 'framebufferTexture2D':
          textureOf.set(framebuffer, args[3]);
          break;
        case 'invalidateFramebuffer':
          frameTargets.push(framebuffer);
          frameStarts.push(draws.length);
          break;
        case 'enable':
        case 'disable':
          if (args[0] === BLEND) {
            blend = name === 'enable';
          }
          break;
        default:
          draws.push({ framebuffer, units: new Map(units), blend });
      }
    }
    return { draws, frameTargets, textureOf, frameStarts };
  }

  function frame(): ArenaFrame {
    return {
      clear: false,
      deltaTimeSec: 1 / 60,
      timeSec: 1,
      view: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      walls: [],
      dynamicWalls: [],
      colonies: [],
      reducedMotion: false,
      nutrients: [],
      balance: gameBalance,
      cursors: [],
      weaponFires: [],
      weaponEffects: [],
      seatColors: new Map(),
      particleBudget: 0,
    };
  }

  function painted() {
    const painting = painterOnFakeContext(WIDTH, HEIGHT);
    painting.painter.setFloor(arenaTheme('petri-dish'), []);
    return painting;
  }

  /** The textures bound to any unit during a draw into a frame target. */
  function sampledWhileDrawnInto({ draws, frameTargets, textureOf }: Replay) {
    const targets = new Set(frameTargets);
    return draws.filter(
      ({ framebuffer, units }) =>
        targets.has(framebuffer) &&
        [...units.values()].includes(textureOf.get(framebuffer))
    );
  }

  it('builds each frame in the other of two targets, laying the floor over the last one unblended', () => {
    const { fake, painter } = painted();

    painter.paint(frame());
    painter.paint(frame());
    painter.paint(frame());

    const { draws, frameTargets, frameStarts, textureOf } = replay(fake);
    expect(frameTargets).toHaveLength(3);
    const [first, second, third] = frameTargets;
    expect(second).not.toBe(first);
    expect(third).toBe(first);
    // The floor is the first draw of a frame: it writes the whole target
    // from the last frame's texture rather than blending over what is kept.
    const floor = draws[frameStarts[2]];
    expect(floor.framebuffer).toBe(third);
    expect(floor.blend).toBe(false);
    expect([...floor.units.values()]).toContain(textureOf.get(second));
  });

  it('unbinds the last frame once the floor is laid on it', () => {
    const { fake, painter } = painted();

    painter.paint(frame());
    painter.paint(frame());

    const { draws, frameStarts } = replay(fake);
    const afterFloor = draws[frameStarts[1] + 1];
    expect(afterFloor).toBeDefined();
    // The floor read it on unit 2; nothing after it in the frame may.
    expect(draws[frameStarts[1]].units.get(2)).not.toBeNull();
    expect(afterFloor.units.get(2)).toBeNull();
  });

  it("points the zones' sampler at the floor's unit on a level without zones", () => {
    const { fake, painter } = painted();

    painter.paint(frame());

    const zones = (fake.calls.get('uniform1i') ?? []).filter(
      ([location]) => (location as { name: string }).name === 'uZones'
    );
    expect(zones).toEqual([[{ name: 'uZones' }, 0]]);
  });

  it('shows the frame it built last', () => {
    const { fake, painter } = painted();
    painter.paint(frame());
    painter.paint(frame());

    painter.showLastFrame();

    const { draws, frameTargets, textureOf } = replay(fake);
    const shown = draws[draws.length - 1];
    expect(shown.framebuffer).toBeNull();
    expect(shown.units.get(0)).toBe(textureOf.get(frameTargets[1]));
  });

  it('never samples the target a frame is drawn into, after a new scale and a restored context too', () => {
    const { fake, canvas, painter } = painted();

    painter.paint(frame());
    painter.showLastFrame();
    painter.setRenderScale(0.5);
    painter.paint(frame());
    painter.paint(frame());
    canvas.dispatchEvent(new Event('webglcontextlost'));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    painter.paint(frame());
    painter.paint(frame());

    const played = replay(fake);
    expect(played.frameTargets).toHaveLength(5);
    expect(sampledWhileDrawnInto(played)).toEqual([]);
  });
});
