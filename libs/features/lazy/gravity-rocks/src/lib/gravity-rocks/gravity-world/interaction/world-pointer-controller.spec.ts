import { computed, signal, WritableSignal } from '@angular/core';
import { vec2 } from '@wolsok/utils-math';
import { WorldCamera } from '../camera/world-camera';
import { GravityWorldService } from '../domain/gravity-world.service';
import { EARTH_MASS, GRAVITATIONAL_CONSTANT } from '../domain/solar-system';
import { Planet } from '../domain/world-objects/planet';
import { Sun } from '../domain/world-objects/sun';
import { OrbitTool } from '../orbit-tool/orbit-tool';
import { Tool } from '../toolbelt/tools';
import { LONG_PRESS_MS } from './pointer-tracker';
import { SpringForce } from './spring-force';
import {
  WorldPointerController,
  WorldPointerIntents,
} from './world-pointer-controller';

/**
 * A world six AU wide in a box of 600 by 360 pixels: a hundred pixels to the
 * AU, the sun at (300, 180) and the earth at (400, 180).
 */
const VIEWPORT = { left: 0, top: 0, width: 600, height: 360 };

interface FakePointer {
  pointerId?: number;
  clientX: number;
  clientY: number;
  button?: number;
  pointerType?: string;
  shiftKey?: boolean;
  on?: string;
}

/** A pointer event at the given client position, on the body with `on`. */
function pointer({
  pointerId = 1,
  clientX,
  clientY,
  button = 0,
  pointerType = 'mouse',
  shiftKey = false,
  on = '',
}: FakePointer): PointerEvent {
  return {
    pointerId,
    clientX,
    clientY,
    button,
    pointerType,
    shiftKey,
    ctrlKey: false,
    metaKey: false,
    target: { id: on },
    preventDefault: jest.fn(),
  } as unknown as PointerEvent;
}

describe('WorldPointerController', () => {
  let sun: Sun;
  let earth: Planet;
  let objects: GravityWorldService;
  let camera: WorldCamera;
  let orbitTool: OrbitTool;
  let tool: WritableSignal<Tool>;
  let running: WritableSignal<boolean>;
  let intents: jest.Mocked<WorldPointerIntents>;
  let controller: WorldPointerController;

  beforeEach(() => {
    sun = new Sun(vec2(3, 1.8), undefined, 1);
    earth = new Planet(vec2(4, 1.8), undefined, EARTH_MASS, 'Earth');
    earth.parent = sun;
    objects = new GravityWorldService();
    objects.addWorldObject(sun);
    objects.addWorldObject(earth);
    camera = new WorldCamera({
      size: signal(vec2(6, 3.6)),
      bodies: objects.worldObjects,
      viewport: () => VIEWPORT,
    });
    orbitTool = new OrbitTool({
      sun: () => sun,
      bodies: objects.worldObjects,
      gravitationalConstant: computed(() => GRAVITATIONAL_CONSTANT),
      reach: computed(() => 3),
    });
    tool = signal('grab');
    running = signal(false);
    intents = {
      tap: jest.fn(),
      openMenu: jest.fn(),
      place: jest.fn((at) => {
        const placed = new Planet(at, undefined, EARTH_MASS);
        objects.addWorldObject(placed);
        return placed;
      }),
      discard: jest.fn((planet) => objects.removeWorldObject(planet)),
      placeSatellite: jest.fn(),
    };
    controller = new WorldPointerController({
      camera,
      orbitTool,
      tool,
      running,
      objects,
      svg: () => undefined,
      intents,
    });
  });

  afterEach(() => {
    controller.dispose();
    jest.useRealTimers();
  });

  describe('tap', () => {
    it('should tap the body let go where it was pressed', () => {
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth' })
      );
      controller.pointerUp(pointer({ clientX: 402, clientY: 181 }));

      expect(intents.tap).toHaveBeenCalledWith(earth);
    });

    it('should not tap a body that was dragged away and back', () => {
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth' })
      );
      controller.pointerMove(pointer({ clientX: 450, clientY: 180 }));
      controller.pointerMove(pointer({ clientX: 400, clientY: 180 }));
      controller.pointerUp(pointer({ clientX: 400, clientY: 180 }));

      expect(intents.tap).not.toHaveBeenCalled();
    });

    it('should leave a press with the right button to the context menu', () => {
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth', button: 2 })
      );
      controller.pointerUp(pointer({ clientX: 400, clientY: 180 }));

      expect(intents.tap).not.toHaveBeenCalled();
    });
  });

  describe('drag and throw', () => {
    it('should hook a spring onto the grabbed body until let go', () => {
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth' })
      );

      expect(objects.forces()).toHaveLength(1);
      expect(objects.forces()[0]).toBeInstanceOf(SpringForce);

      controller.pointerUp(pointer({ clientX: 400, clientY: 180 }));
      expect(objects.forces()).toEqual([]);
    });

    it('should throw a body let go in a paused world', () => {
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth' })
      );
      controller.pointerMove(pointer({ clientX: 450, clientY: 180 }));
      controller.pointerUp(pointer({ clientX: 450, clientY: 180 }));

      expect(earth.vel.x).toBeGreaterThan(0);
      expect(earth.vel.y).toBeCloseTo(0);
    });

    it('should leave the throw to the spring in a running world', () => {
      running.set(true);
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth' })
      );
      controller.pointerMove(pointer({ clientX: 450, clientY: 180 }));
      controller.pointerUp(pointer({ clientX: 450, clientY: 180 }));

      expect(earth.vel.length()).toBe(0);
    });

    it('should never throw the static sun', () => {
      controller.pointerDown(
        pointer({ clientX: 300, clientY: 180, on: 'Sun' })
      );
      controller.pointerMove(pointer({ clientX: 350, clientY: 180 }));
      controller.pointerUp(pointer({ clientX: 350, clientY: 180 }));

      expect(sun.vel.length()).toBe(0);
    });

    it('should not drag with a tool that acts on the tap', () => {
      tool.set('select');

      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth' })
      );

      expect(objects.forces()).toEqual([]);
    });
  });

  describe('add tool', () => {
    beforeEach(() => tool.set('add'));

    it('should place a body on empty space and drag it', () => {
      controller.pointerDown(pointer({ clientX: 100, clientY: 100 }));

      expect(intents.place).toHaveBeenCalledTimes(1);
      const [at] = intents.place.mock.calls[0];
      expect(at.x).toBeCloseTo(1);
      expect(at.y).toBeCloseTo(1);
      expect(objects.forces()).toHaveLength(1);
      expect(camera.isPanning).toBe(false);
    });

    it('should take a placed body back when the system cancels the gesture', () => {
      controller.pointerDown(pointer({ clientX: 100, clientY: 100 }));
      const placed: Planet = intents.place.mock.results[0].value;

      controller.pointerCancel(pointer({ clientX: 100, clientY: 100 }));

      expect(intents.discard).toHaveBeenCalledWith(placed);
      expect(objects.forces()).toEqual([]);
    });

    it('should keep a placed body once let go', () => {
      controller.pointerDown(pointer({ clientX: 100, clientY: 100 }));
      controller.pointerUp(pointer({ clientX: 100, clientY: 100 }));

      expect(intents.discard).not.toHaveBeenCalled();
    });
  });

  describe('pan and zoom', () => {
    it('should pan on empty space with the grab tool', () => {
      const before = camera.center();

      controller.pointerDown(pointer({ clientX: 100, clientY: 100 }));
      controller.pointerMove(pointer({ clientX: 200, clientY: 100 }));

      expect(camera.center().x).toBeCloseTo(before.x - 1);
      controller.pointerUp(pointer({ clientX: 200, clientY: 100 }));
      expect(camera.isPanning).toBe(false);
    });

    it('should pan rather than drag a body with shift held', () => {
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth', shiftKey: true })
      );

      expect(camera.isPanning).toBe(true);
      expect(objects.forces()).toEqual([]);
    });

    it('should pan with the middle button', () => {
      controller.pointerDown(
        pointer({ clientX: 400, clientY: 180, on: 'Earth', button: 1 })
      );

      expect(camera.isPanning).toBe(true);
    });

    it('should pinch with a second finger, dropping the drag of the first', () => {
      controller.pointerDown(
        pointer({ pointerId: 1, clientX: 400, clientY: 180, on: 'Earth' })
      );
      controller.pointerDown(
        pointer({ pointerId: 2, clientX: 500, clientY: 180 })
      );

      expect(camera.isPinching).toBe(true);
      expect(objects.forces()).toEqual([]);

      controller.pointerMove(
        pointer({ pointerId: 2, clientX: 600, clientY: 180 })
      );
      expect(camera.zoom()).toBeGreaterThan(1);
    });

    it('should ignore a third finger', () => {
      controller.pointerDown(
        pointer({ pointerId: 1, clientX: 100, clientY: 100 })
      );
      controller.pointerDown(
        pointer({ pointerId: 2, clientX: 200, clientY: 100 })
      );
      controller.pointerDown(
        pointer({ pointerId: 3, clientX: 400, clientY: 180, on: 'Earth' })
      );

      expect(objects.forces()).toEqual([]);
    });

    it('should zoom in on wheel up and leave a sideways wheel alone', () => {
      const sideways = { deltaY: 0, preventDefault: jest.fn() };
      controller.wheel(sideways as unknown as WheelEvent);
      expect(sideways.preventDefault).not.toHaveBeenCalled();
      expect(camera.zoom()).toBe(1);

      const up = {
        deltaY: -100,
        clientX: 300,
        clientY: 180,
        preventDefault: jest.fn(),
      };
      controller.wheel(up as unknown as WheelEvent);
      expect(up.preventDefault).toHaveBeenCalled();
      expect(camera.zoom()).toBeGreaterThan(1);
    });
  });

  describe('menu', () => {
    it('should open the menu of the body under a right click', () => {
      const event = pointer({ clientX: 400, clientY: 180, on: 'Earth' });

      controller.contextMenu(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(intents.openMenu).toHaveBeenCalledWith(earth);
    });

    it('should leave a right click on empty space to the browser', () => {
      const event = pointer({ clientX: 100, clientY: 100 });

      controller.contextMenu(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(intents.openMenu).not.toHaveBeenCalled();
    });

    it('should let go of a body the browser long press caught', () => {
      controller.pointerDown(
        pointer({
          clientX: 400,
          clientY: 180,
          on: 'Earth',
          pointerType: 'touch',
        })
      );

      controller.contextMenu(
        pointer({ clientX: 400, clientY: 180, on: 'Earth' })
      );

      expect(objects.forces()).toEqual([]);
      expect(intents.openMenu).toHaveBeenCalledWith(earth);
    });

    it('should open the menu once a finger rests on a body', () => {
      jest.useFakeTimers();
      controller.pointerDown(
        pointer({
          clientX: 400,
          clientY: 180,
          on: 'Earth',
          pointerType: 'touch',
        })
      );

      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(intents.openMenu).toHaveBeenCalledWith(earth);
      expect(objects.forces()).toEqual([]);
    });

    it('should not open the menu for a finger that moved on', () => {
      jest.useFakeTimers();
      controller.pointerDown(
        pointer({
          clientX: 400,
          clientY: 180,
          on: 'Earth',
          pointerType: 'touch',
        })
      );
      controller.pointerMove(pointer({ clientX: 450, clientY: 180 }));

      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(intents.openMenu).not.toHaveBeenCalled();
    });

    it('should stop a pending long press on dispose', () => {
      jest.useFakeTimers();
      controller.pointerDown(
        pointer({
          clientX: 400,
          clientY: 180,
          on: 'Earth',
          pointerType: 'touch',
        })
      );

      controller.dispose();
      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(intents.openMenu).not.toHaveBeenCalled();
    });
  });

  describe('orbit tool', () => {
    beforeEach(() => {
      tool.set('orbit');
      orbitTool.pick(sun);
    });

    it('should let a satellite go onto the orbit drawn beside the body', () => {
      controller.pointerDown(pointer({ clientX: 450, clientY: 180 }));
      controller.pointerMove(pointer({ clientX: 460, clientY: 180 }));
      controller.pointerUp(pointer({ clientX: 460, clientY: 180 }));

      expect(intents.placeSatellite).toHaveBeenCalledTimes(1);
      const [parent, distance, angle] = intents.placeSatellite.mock.calls[0];
      expect(parent).toBe(sun);
      expect(distance).toBeCloseTo(1.6);
      expect(angle).toBeCloseTo(0);
      expect(orbitTool.isHeld).toBe(false);
    });

    it('should let go of the orbit without a satellite on cancel', () => {
      controller.pointerDown(pointer({ clientX: 450, clientY: 180 }));

      controller.pointerCancel(pointer({ clientX: 450, clientY: 180 }));

      expect(orbitTool.isHeld).toBe(false);
      expect(intents.placeSatellite).not.toHaveBeenCalled();
    });

    it('should keep a browser long press from cutting a held orbit short', () => {
      controller.pointerDown(pointer({ clientX: 450, clientY: 180 }));
      const event = pointer({ clientX: 450, clientY: 180, on: 'Earth' });

      controller.contextMenu(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(intents.openMenu).not.toHaveBeenCalled();
      expect(orbitTool.isHeld).toBe(true);
    });

    it('should draw the orbit after a hovering mouse', () => {
      controller.pointerMove(pointer({ clientX: 420, clientY: 180 }));

      expect(orbitTool.preview()?.radius).toBeCloseTo(1.2);
    });
  });
});
