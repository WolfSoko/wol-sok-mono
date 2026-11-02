import { getColonyColor, NEUTRAL_COLOR } from '../state/colony-colors';
import { getLevel, levelBalance, levelMap } from '../state/levels';
import { mapZones } from '../state/zones';
import { arenaTheme } from './arena-theme';
import {
  colonyRadius,
  floorPixels,
  grainPixels,
  levelPreviewScene,
  MIN_COLONY_SHARE,
  paintLevelPreview,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  PreviewContext,
  previewScale,
  zonePixels,
} from './level-preview';

describe('level preview', () => {
  describe('levelPreviewScene', () => {
    it('lays the two colonies on their spawn spots, orange left and blue right', () => {
      const scene = levelPreviewScene('petri-dish');
      const radius = levelBalance(getLevel('petri-dish')).startBacteriaRadius;

      expect(scene).toEqual(
        expect.objectContaining({ width: 320, height: 180, size: 1 })
      );
      expect(scene.colonies).toEqual([
        {
          role: 'left',
          x: 80,
          y: 90,
          radius,
          color: getColonyColor('orange').rgb,
        },
        {
          role: 'right',
          x: 240,
          y: 90,
          radius,
          color: getColonyColor('blue').rgb,
        },
      ]);
    });

    it('takes the walls, zones and moving walls at the start from the map', () => {
      const pistons = levelPreviewScene('pistons');
      const map = levelMap(getLevel('pistons'));

      expect(pistons.walls).toEqual(map.createWalls(320, 180));
      expect(pistons.dynamicWalls.length).toBeGreaterThan(0);
      expect(pistons.dynamicWalls).toEqual(
        map.createDynamicWalls?.(320, 180, 0)
      );

      const containment = levelPreviewScene('containment');
      expect(containment.zones.length).toBeGreaterThan(0);
      expect(containment.zones).toEqual(
        mapZones(levelMap(getLevel('containment')), 320, 180)
      );
    });

    it('paints the level in its own arena colours', () => {
      expect(levelPreviewScene('heartbeat').theme).toBe(
        arenaTheme('heartbeat')
      );
    });

    it('shows all of a big map, its neutral colonies grey', () => {
      const scene = levelPreviewScene('expanse');
      const neutrals = scene.colonies.filter((c) => c.role === 'neutral');

      expect(scene).toEqual(
        expect.objectContaining({ width: 640, height: 360, size: 2 })
      );
      expect(scene.colonies[0]).toEqual(
        expect.objectContaining({ x: 160, y: 180 })
      );
      expect(scene.colonies[1]).toEqual(
        expect.objectContaining({ x: 480, y: 180 })
      );
      expect(neutrals).toHaveLength(getLevel('expanse').neutrals?.length ?? 0);
      expect(neutrals.length).toBeGreaterThan(0);
      for (const colony of neutrals) {
        expect(colony.color).toEqual(NEUTRAL_COLOR.slice(0, 3));
        expect(colony.x).toBeGreaterThanOrEqual(0);
        expect(colony.x).toBeLessThanOrEqual(640);
      }
    });

    it('makes the right colony a boss where the level has one, as big as it starts', () => {
      const level = getLevel('meltdown');
      const scene = levelPreviewScene('meltdown');
      const radius = levelBalance(level).startBacteriaRadius;

      expect(level.boss).toBeDefined();
      expect(scene.colonies[1].role).toBe('boss');
      expect(scene.colonies[1].radius).toBeCloseTo(
        radius * Math.sqrt(level.boss?.startScale ?? 1)
      );
      expect(scene.colonies[1].radius).toBeGreaterThan(
        scene.colonies[0].radius
      );
    });

    it('draws a generated level from its own layout', () => {
      const id = 'gen:cave:77:8';
      const scene = levelPreviewScene(id);

      expect(scene.levelId).toBe(id);
      expect(scene.theme).toBe(arenaTheme(id));
      expect(scene.walls).toEqual(levelMap(getLevel(id)).createWalls(320, 180));
      expect(scene.walls.length).toBeGreaterThan(0);
    });
  });

  it('fits the whole map into the preview', () => {
    expect(previewScale(levelPreviewScene('petri-dish'))).toBe(2);
    expect(previewScale(levelPreviewScene('expanse'))).toBe(1);
  });

  it('draws no colony too small to tell apart, a boss bigger still', () => {
    const tiny = {
      role: 'left' as const,
      x: 0,
      y: 0,
      radius: 1,
      color: [1, 2, 3] as const,
    };
    const least = PREVIEW_WIDTH * MIN_COLONY_SHARE;

    expect(colonyRadius(tiny, 1)).toBe(least);
    expect(colonyRadius({ ...tiny, role: 'boss' }, 1)).toBeGreaterThan(least);
    expect(colonyRadius({ ...tiny, radius: 30 }, 2)).toBe(60);
  });

  it('paints the floor a pixel per cell, never wider than the preview', () => {
    expect(floorPixels(levelPreviewScene('petri-dish'))).toEqual(
      expect.objectContaining({ width: 320, height: 180 })
    );
    const big = floorPixels(levelPreviewScene('expanse'));
    expect(big.width).toBe(PREVIEW_WIDTH);
    expect(big.data).toHaveLength(PREVIEW_WIDTH * PREVIEW_HEIGHT * 4);
  });

  it('paints the zones only where the level has some', () => {
    expect(zonePixels(levelPreviewScene('petri-dish'))).toBeNull();
    const layer = zonePixels(levelPreviewScene('containment'));
    expect(layer?.width).toBe(640);
  });

  it('makes a grain of opaque greys around the middle', () => {
    const data = grainPixels(4);
    expect(data).toHaveLength(64);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBeGreaterThanOrEqual(96);
      expect(data[i]).toBeLessThanOrEqual(160);
      expect(data[i + 3]).toBe(255);
    }
  });

  describe('paintLevelPreview', () => {
    /** A context that records the calls it gets and does nothing. */
    function recorder(): { cx: PreviewContext; calls: string[] } {
      const calls: string[] = [];
      const gradient = { addColorStop: () => undefined };
      const cx = new Proxy({} as Record<string, unknown>, {
        get: (target, name: string) =>
          name in target
            ? target[name]
            : (...args: unknown[]) => {
                calls.push(name);
                return name.startsWith('create') ? gradient : args[0];
              },
        set: (target, name: string, value) => {
          target[name] = value;
          return true;
        },
      });
      return { cx: cx as unknown as PreviewContext, calls };
    }

    const NO_LAYERS = { floor: null, zones: null, grain: null };

    it('draws the floor and the zones over the whole preview', () => {
      const { cx, calls } = recorder();
      const floor = {} as CanvasImageSource;
      const zones = {} as CanvasImageSource;

      paintLevelPreview(cx, levelPreviewScene('containment'), {
        floor,
        zones,
        grain: null,
      });

      expect(calls.filter((call) => call === 'drawImage')).toHaveLength(2);
    });

    it('frames the preview and leaves the context as it found it', () => {
      const { cx, calls } = recorder();

      paintLevelPreview(cx, levelPreviewScene('meltdown'), NO_LAYERS);

      expect(calls).toContain('roundRect');
      expect(calls.filter((call) => call === 'save')).toHaveLength(
        calls.filter((call) => call === 'restore').length
      );
    });

    it('bristles a boss with spikes the plain colonies do not have', () => {
      const plain = recorder();
      const boss = recorder();
      const scene = levelPreviewScene('petri-dish');
      const [left, right] = scene.colonies;

      paintLevelPreview(plain.cx, scene, NO_LAYERS);
      paintLevelPreview(
        boss.cx,
        { ...scene, colonies: [left, { ...right, role: 'boss' }] },
        NO_LAYERS
      );

      const strokes = (calls: string[]) =>
        calls.filter((call) => call === 'stroke').length;
      expect(strokes(boss.calls)).toBeGreaterThan(strokes(plain.calls));
    });
  });
});
