/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { qaSelector } from '@wolsok/test-helper';
import { vec2 } from '@wolsok/utils-math';
import { GravityConfigComponent } from './config/gravity-config.component';
import { INITIAL_CONFIG } from './domain/gravity-world-config';
import { Planet } from './domain/world-objects/planet';

// minimal mock service (if needed could be expanded) but we rely on real implementation for now
import {
  GravityWorldComponent,
  MAX_MASS_EXPONENT,
  MAX_SPEED,
  MAX_ZOOM,
  MIN_ZOOM,
} from './gravity-world.component';

/** First element in the rendered component matching the css selector. */
function query<T extends Element>(
  fixture: ComponentFixture<GravityWorldComponent>,
  sel: string
): T | null {
  return fixture.nativeElement.querySelector(sel);
}

describe('GravityWorldComponent', () => {
  let fixture: ComponentFixture<GravityWorldComponent>;
  let component: GravityWorldComponent;

  beforeEach(async () => {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    await TestBed.configureTestingModule({
      imports: [GravityWorldComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: INITIAL_CONFIG,
          useValue: {
            gravitationalConstant: 10,
            massOfSun: 10000,
            showTrail: true,
            trailLength: 100,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GravityWorldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have a start button', () => {
    const btn = query<HTMLButtonElement>(fixture, qaSelector('cta-start'));
    expect(btn?.textContent?.trim()).toBe('Start');
  });

  it('should start the simulation', () => {
    const btn = query<HTMLButtonElement>(fixture, qaSelector('cta-start'))!;
    btn.click();
    fixture.detectChanges();
    expect(btn.textContent?.trim()).toBe('Pause');
  });

  it('should start again after pause', () => {
    const btn = query<HTMLButtonElement>(fixture, qaSelector('cta-start'))!;
    btn.click(); // start
    fixture.detectChanges();
    btn.click(); // pause
    fixture.detectChanges();
    expect(btn.textContent?.trim()).toBe('Start');
  });

  it('should have a reset button', () => {
    const btn = query<HTMLButtonElement>(fixture, qaSelector('cta-reset'));
    expect(btn?.textContent?.trim()).toBe('Reset');
  });

  it('should stop simulation on reset', () => {
    const start = query<HTMLButtonElement>(fixture, qaSelector('cta-start'))!;
    const reset = query<HTMLButtonElement>(fixture, qaSelector('cta-reset'))!;
    start.click();
    fixture.detectChanges();
    reset.click();
    fixture.detectChanges();
    expect(start.textContent?.trim()).toBe('Start');
  });

  it('should show the config when toggled', () => {
    const toggle = query<HTMLButtonElement>(
      fixture,
      qaSelector('cta-toggle-config')
    )!;
    toggle.click();
    fixture.detectChanges();
    // component template should now include config component
    const config = fixture.debugElement.query(
      (d) => d.componentInstance instanceof GravityConfigComponent
    );
    expect(config).toBeTruthy();
  });

  describe('zooming and panning', () => {
    const rect = {
      left: 0,
      top: 0,
      width: 500,
      height: 300,
    } as DOMRect;

    beforeEach(() => {
      jest
        .spyOn(component.svgWorld.nativeElement, 'getBoundingClientRect')
        .mockReturnValue(rect);
    });

    afterEach(() => jest.restoreAllMocks());

    it('should show the whole world initially', () => {
      expect(component.zoom()).toBe(1);
      expect(component.zoomLabel()).toBe('100%');
      expect(component.viewBox()).toBe(
        `0 0 ${component.canvasSize().x} ${component.canvasSize().y}`
      );
    });

    it('should render the viewBox of the current viewport', () => {
      const svg = query<SVGSVGElement>(fixture, 'svg')!;
      component.zoomIn();
      fixture.detectChanges();
      expect(svg.getAttribute('viewBox')).toBe(component.viewBox());
    });

    it('should zoom in around the view center', () => {
      component.zoomIn();
      expect(component.zoom()).toBeGreaterThan(1);
      // the center stays put, the visible area shrinks
      expect(component.viewCenter()).toEqual(component.canvasSize().div(2));
      const [, , width] = component.viewBox().split(' ').map(Number);
      expect(width).toBeLessThan(component.canvasSize().x);
    });

    it('should zoom out again', () => {
      component.zoomIn();
      const zoomedIn = component.zoom();
      component.zoomOut();
      expect(component.zoom()).toBeLessThan(zoomedIn);
    });

    it('should not zoom beyond the limits', () => {
      for (let i = 0; i < 50; i++) {
        component.zoomIn();
      }
      expect(component.zoom()).toBe(MAX_ZOOM);
      expect(component.canZoomIn()).toBe(false);

      for (let i = 0; i < 100; i++) {
        component.zoomOut();
      }
      expect(component.zoom()).toBe(MIN_ZOOM);
      expect(component.canZoomOut()).toBe(false);
    });

    it('should zoom out down to 0.1 percent', () => {
      for (let i = 0; i < 100; i++) {
        component.zoomOut();
      }
      fixture.detectChanges();
      expect(component.zoom()).toBe(0.001);
      expect(component.zoomLabel()).toBe('0.1%');
      expect(
        query(fixture, qaSelector('zoom-level'))?.textContent?.trim()
      ).toBe('0.1%');
      // the whole world fits into a tiny part of the viewport now
      const [, , width] = component.viewBox().split(' ').map(Number);
      expect(width).toBe(component.canvasSize().x / 0.001);
    });

    it('should show one decimal for every zoom level below ten percent', () => {
      component.zoom.set(0.01);
      fixture.detectChanges();
      expect(component.zoomLabel()).toBe('1.0%');
      expect(
        query(fixture, qaSelector('zoom-level'))?.textContent?.trim()
      ).toBe('1.0%');
    });

    it('should have zoom buttons', () => {
      const zoomIn = query<HTMLButtonElement>(
        fixture,
        qaSelector('cta-zoom-in')
      )!;
      const zoomOut = query<HTMLButtonElement>(
        fixture,
        qaSelector('cta-zoom-out')
      )!;
      zoomIn.click();
      fixture.detectChanges();
      const zoomedIn = component.zoom();
      expect(zoomedIn).toBeGreaterThan(1);
      expect(
        query(fixture, qaSelector('zoom-level'))?.textContent?.trim()
      ).toBe(component.zoomLabel());

      zoomOut.click();
      fixture.detectChanges();
      expect(component.zoom()).toBeLessThan(zoomedIn);
    });

    it('should zoom towards the mouse position on wheel', () => {
      component.wheel(wheelEvent(-100, 0, 0));
      expect(component.zoom()).toBeGreaterThan(1);
      // zoomed towards the top left corner, so the center moves there too
      expect(component.viewCenter().x).toBeLessThan(
        component.canvasSize().x / 2
      );
      expect(component.viewCenter().y).toBeLessThan(
        component.canvasSize().y / 2
      );
    });

    it('should zoom out on wheel down', () => {
      component.zoomIn();
      const zoomedIn = component.zoom();
      component.wheel(wheelEvent(100, 250, 150));
      expect(component.zoom()).toBeLessThan(zoomedIn);
    });

    it('should reset the view', () => {
      component.wheel(wheelEvent(-100, 0, 0));
      const resetView = query<HTMLButtonElement>(
        fixture,
        qaSelector('cta-reset-view')
      )!;
      resetView.click();
      fixture.detectChanges();
      expect(component.zoom()).toBe(1);
      expect(component.viewCenter()).toEqual(component.canvasSize().div(2));
    });

    it('should reset the view when the world is reset', () => {
      component.zoomIn();
      component.reset();
      expect(component.zoom()).toBe(1);
      expect(component.viewCenter()).toEqual(component.canvasSize().div(2));
    });

    it('should pan with shift and drag without creating a planet', () => {
      component.zoomIn();
      const planetsBefore = component.planets().length;
      const centerBefore = component.viewCenter();

      component.pointerDown(pointerEvent(250, 150, { shiftKey: true }));
      component.pointerMove(pointerEvent(200, 150, { shiftKey: true }));

      expect(component.planets().length).toBe(planetsBefore);
      expect(component.viewCenter().x).toBeGreaterThan(centerBefore.x);

      component.pointerUp(pointerEvent(200, 150));
      const centerAfterUp = component.viewCenter();
      component.pointerMove(pointerEvent(100, 150));
      expect(component.viewCenter()).toEqual(centerAfterUp);
    });

    it('should keep the view center inside the world while panning', () => {
      component.pointerDown(pointerEvent(250, 150, { shiftKey: true }));
      component.pointerMove(pointerEvent(-5000, -5000, { shiftKey: true }));
      expect(component.viewCenter().x).toBe(component.canvasSize().x);
      expect(component.viewCenter().y).toBe(component.canvasSize().y);
    });

    it('should zoom out when two fingers pinch together', () => {
      component.pointerDown(touch(1, 150, 150));
      component.pointerDown(touch(2, 350, 150));
      component.pointerMove(touch(1, 230, 150));
      component.pointerMove(touch(2, 270, 150));

      // the fingers ended up five times closer together
      expect(component.zoom()).toBeCloseTo(0.2, 5);
    });

    it('should zoom in when two fingers spread apart', () => {
      component.pointerDown(touch(1, 240, 150));
      component.pointerDown(touch(2, 260, 150));
      component.pointerMove(touch(1, 150, 150));
      component.pointerMove(touch(2, 350, 150));

      expect(component.zoom()).toBeCloseTo(10, 5);
    });

    it('should pan when two fingers move together', () => {
      component.zoomIn();
      const centerBefore = component.viewCenter();

      component.pointerDown(touch(1, 200, 150));
      component.pointerDown(touch(2, 300, 150));
      component.pointerMove(touch(1, 150, 150));
      component.pointerMove(touch(2, 250, 150));

      // the fingers kept their distance, so only the view moved
      expect(component.zoom()).toBeCloseTo(1.3, 5);
      expect(component.viewCenter().x).toBeGreaterThan(centerBefore.x);
      expect(component.viewCenter().y).toBe(centerBefore.y);
    });

    it('should take back the planet the first finger of a pinch created', () => {
      const planetsBefore = component.planets().length;

      component.pointerDown(touch(1, 200, 150));
      expect(component.planets().length).toBe(planetsBefore + 1);

      component.pointerDown(touch(2, 300, 150));

      expect(component.planets().length).toBe(planetsBefore);
      expect(component.worldService.getForces()).toEqual([]);
    });

    it('should not resume dragging when one finger of a pinch lifts', () => {
      component.pointerDown(touch(1, 200, 150));
      component.pointerDown(touch(2, 300, 150));
      component.pointerUp(touch(2, 300, 150));
      const zoomAfterPinch = component.zoom();

      component.pointerMove(touch(1, 100, 150));

      expect(component.zoom()).toBe(zoomAfterPinch);
      expect(component.worldService.getForces()).toEqual([]);
    });

    it('should capture both fingers of a pinch', () => {
      const svg = component.svgWorld.nativeElement;
      svg.setPointerCapture = jest.fn();

      component.pointerDown(touch(1, 200, 150));
      component.pointerDown(touch(2, 300, 150));

      // a finger that leaves the svg keeps feeding the gesture
      expect(svg.setPointerCapture).toHaveBeenCalledWith(1);
      expect(svg.setPointerCapture).toHaveBeenCalledWith(2);
    });

    it('should ignore a third finger', () => {
      component.pointerDown(touch(1, 200, 150));
      component.pointerDown(touch(2, 300, 150));
      const zoomOfTwoFingers = component.zoom();

      component.pointerDown(touch(3, 100, 400));
      component.pointerMove(touch(3, 50, 500));

      // the pinch stays with the two fingers that started it
      expect(component.zoom()).toBe(zoomOfTwoFingers);

      // and a third finger lifting does not end their gesture either
      component.pointerUp(touch(3, 50, 500));
      component.pointerMove(touch(1, 150, 150));
      component.pointerMove(touch(2, 350, 150));
      expect(component.zoom()).toBeGreaterThan(zoomOfTwoFingers);
    });

    it('should release only a capture it holds', () => {
      const svg = component.svgWorld.nativeElement;
      svg.hasPointerCapture = jest.fn().mockReturnValue(false);
      svg.releasePointerCapture = jest.fn();

      component.pointerDown(touch(1, 200, 150));
      component.pointerUp(touch(1, 200, 150));

      expect(svg.releasePointerCapture).not.toHaveBeenCalled();
    });

    /** Finger `id` on the empty background at the given client position. */
    function touch(id: number, clientX: number, clientY: number): PointerEvent {
      const event = pointerEvent(clientX, clientY, {
        pointerId: id,
        pointerType: 'touch',
      });
      Object.defineProperty(event, 'target', {
        value: query(fixture, 'svg')!,
      });
      return event;
    }
  });

  describe('following on click', () => {
    const rect = {
      left: 0,
      top: 0,
      width: 500,
      height: 300,
    } as DOMRect;

    /** Mouse event targeting the svg element of the given world object. */
    function eventOn(
      id: string,
      clientX: number,
      clientY: number,
      init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}
    ): PointerEvent {
      return eventOnElement(
        query(fixture, `[id="${id}"]`)!,
        clientX,
        clientY,
        init
      );
    }

    /** Pointer event targeting the empty svg background, as a browser would. */
    function eventOnBackground(
      clientX: number,
      clientY: number,
      init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}
    ): PointerEvent {
      return eventOnElement(query(fixture, 'svg')!, clientX, clientY, init);
    }

    /** Pointer event at the given client position, targeting that element. */
    function eventOnElement(
      target: Element,
      clientX: number,
      clientY: number,
      init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}
    ): PointerEvent {
      const event = pointerEvent(clientX, clientY, init);
      Object.defineProperty(event, 'target', { value: target });
      return event;
    }

    beforeEach(() => {
      jest
        .spyOn(component.svgWorld.nativeElement, 'getBoundingClientRect')
        .mockReturnValue(rect);
    });

    afterEach(() => jest.restoreAllMocks());

    /** Presses and releases on the given world object without moving. */
    function clickOn(id: string): void {
      component.pointerDown(eventOn(id, 100, 100));
      component.pointerUp(eventOn(id, 100, 100));
    }

    it('should center a planet that is clicked', () => {
      const planet = component.planets()[0];
      expect(planet.pos).not.toEqual(component.viewCenter());

      clickOn(planet.id);

      expect(component.viewCenter()).toEqual(planet.pos);
      expect(component.followedId()).toBe(planet.id);
    });

    it('should keep the followed planet centered while it moves', () => {
      const planet = component.planets()[0];
      clickOn(planet.id);

      for (let frame = 0; frame < 30; frame++) {
        component.step(1 / 60);
        expect(component.viewCenter()).toEqual(planet.pos);
      }
      // the planet really did move, so this was not a standstill
      expect(planet.pos).not.toEqual(component.canvasSize().div(2));
    });

    it('should not move the view for a planet it does not follow', () => {
      const [planet, other] = component.planets();
      clickOn(planet.id);
      const centerBefore = component.viewCenter();

      component.step(1 / 60);

      expect(component.viewCenter()).not.toEqual(other.pos);
      expect(component.viewCenter()).not.toEqual(centerBefore);
    });

    it('should let go of the planet when it is clicked again', () => {
      const planet = component.planets()[0];
      clickOn(planet.id);
      clickOn(planet.id);
      expect(component.followedId()).toBeNull();

      // the view stays where following left it
      const centerBefore = component.viewCenter();
      component.step(1 / 60);
      expect(component.viewCenter()).toEqual(centerBefore);
    });

    it('should switch to another planet that is clicked', () => {
      const [planet, other] = component.planets();
      clickOn(planet.id);
      clickOn(other.id);

      expect(component.followedId()).toBe(other.id);
      expect(component.viewCenter()).toEqual(other.pos);
    });

    it('should let go when the view is reset', () => {
      clickOn(component.planets()[0].id);
      component.resetView();
      expect(component.followedId()).toBeNull();
    });

    it('should let go when panning takes over', () => {
      clickOn(component.planets()[0].id);

      component.pointerDown(pointerEvent(250, 150, { shiftKey: true }));
      component.pointerMove(pointerEvent(200, 150, { shiftKey: true }));
      component.pointerUp(pointerEvent(200, 150));

      expect(component.followedId()).toBeNull();
    });

    it('should let go when the followed planet is removed', () => {
      const planet = component.planets()[0];
      clickOn(planet.id);

      component.removePlanet(planet);

      expect(component.followedId()).toBeNull();
    });

    it('should keep the followed planet centered while zooming', () => {
      const planet = component.planets()[0];
      clickOn(planet.id);

      component.wheel(wheelEvent(-100, 0, 0));

      expect(component.zoom()).toBeGreaterThan(1);
      expect(component.viewCenter()).toEqual(planet.pos);
    });

    it('should offer a button to stop following', () => {
      clickOn(component.planets()[0].id);
      fixture.detectChanges();

      const stop = query<HTMLButtonElement>(
        fixture,
        qaSelector('cta-stop-follow')
      )!;
      stop.click();
      fixture.detectChanges();

      expect(component.followedId()).toBeNull();
      expect(query(fixture, qaSelector('cta-stop-follow'))).toBeNull();
    });

    it('should mark the followed planet in the svg', () => {
      const planet = component.planets()[0];
      clickOn(planet.id);
      fixture.detectChanges();

      expect(
        query(fixture, `[id="${planet.id}"]`)?.classList.contains('followed')
      ).toBe(true);
      expect(query(fixture, 'circle.sun')?.classList.contains('followed')).toBe(
        false
      );
    });

    it('should tolerate a tiny cursor movement while clicking', () => {
      const planet = component.planets()[0];

      component.pointerDown(eventOn(planet.id, 100, 100));
      component.pointerMove(eventOn(planet.id, 102, 101));
      component.pointerUp(eventOn(planet.id, 102, 101));

      expect(component.viewCenter()).toEqual(planet.pos);
    });

    it('should center and follow the sun as well', () => {
      component.zoomIn();
      clickOn(component.sun.id);

      expect(component.viewCenter()).toEqual(component.sun.pos);
      expect(component.followedId()).toBe(component.sun.id);
    });

    it('should not center when a drag returns to where it started', () => {
      const planet = component.planets()[0];
      const centerBefore = component.viewCenter();

      component.pointerDown(eventOn(planet.id, 100, 100));
      component.pointerMove(eventOn(planet.id, 260, 180));
      component.pointerMove(eventOn(planet.id, 100, 100));
      component.pointerUp(eventOn(planet.id, 100, 100));

      expect(component.viewCenter()).toEqual(centerBefore);
    });

    it('should not center when the planet is dragged', () => {
      const planet = component.planets()[0];
      const centerBefore = component.viewCenter();

      component.pointerDown(eventOn(planet.id, 100, 100));
      component.pointerMove(eventOn(planet.id, 200, 150));
      component.pointerUp(eventOn(planet.id, 200, 150));

      expect(component.viewCenter()).toEqual(centerBefore);
    });

    it('should fling a new planet with the drag that created it', () => {
      const planetsBefore = component.planets().length;

      dragTouch({ from: [100, 100], to: [180, 140] });

      expect(component.planets().length).toBe(planetsBefore + 1);
      const created = component.planets()[component.planets().length - 1];
      // thrown towards the finger, which went right and down
      expect(created.vel.x).toBeGreaterThan(0);
      expect(created.vel.y).toBeGreaterThan(0);
    });

    it('should throw a planet while the simulation is paused', () => {
      expect(component.running()).toBe(false);
      const planet = placePlanetUnder(300, 150);

      // press on the planet and take the finger far to the left
      component.pointerDown(eventOn(planet.id, 300, 150));
      component.pointerMove(eventOn(planet.id, 100, 150));
      component.pointerUp(eventOn(planet.id, 100, 150));

      // the spring never ticked, the release throws instead: 200px left is
      // 1200 world units, more than a world object may ever travel
      expect(planet.vel.x).toBeLessThan(0);
      expect(Math.abs(planet.vel.y)).toBeLessThan(1);
      expect(planet.vel.length()).toBeCloseTo(MAX_SPEED, 6);
    });

    it('should throw as far as the gesture stretched the spring', () => {
      const planet = placePlanetUnder(300, 150);

      component.pointerDown(eventOn(planet.id, 300, 150));
      component.pointerMove(eventOn(planet.id, 350, 150));
      component.pointerUp(eventOn(planet.id, 350, 150));

      // the spring pulls as hard as it is stretched, so the throw is as fast:
      // 50px of a 500px wide view is 300 units of a 3000 unit wide world
      expect(planet.vel.x).toBeCloseTo(300, 6);
      expect(planet.vel.y).toBeCloseTo(0, 6);
    });

    /** Moves the first planet to rest exactly under the given client point. */
    function placePlanetUnder(clientX: number, clientY: number): Planet {
      const planet = component.planets()[0];
      // the whole world is on screen, so client maps to world by the ratio of
      // the two: 3000 / 500 across and 1800 / 300 down
      planet.pos = vec2(clientX * 6, clientY * 6);
      planet.vel = vec2(0, 0);
      // refresh the planets signal through a public api
      component.step(0);
      return planet;
    }

    it('should not throw a planet that was only tapped', () => {
      const planet = component.planets()[0];
      const velBefore = planet.vel;

      component.pointerDown(eventOn(planet.id, 100, 100));
      component.pointerMove(eventOn(planet.id, 102, 101));
      component.pointerUp(eventOn(planet.id, 102, 101));

      expect(planet.vel).toEqual(velBefore);
    });

    it('should leave the throw to the spring while the simulation runs', () => {
      component.toggleSim();
      expect(component.running()).toBe(true);
      const planet = component.planets()[0];
      planet.vel = vec2(0, 0);

      component.pointerDown(eventOn(planet.id, 100, 150));
      component.pointerMove(eventOn(planet.id, 300, 150));
      component.pointerUp(eventOn(planet.id, 300, 150));

      // no frame was rendered, so the spring had no chance to act - and the
      // release must not step in for it
      expect(planet.vel).toEqual(vec2(0, 0));
    });

    it('should not throw when a second finger cancels the gesture', () => {
      const planetsBefore = component.planets().length;

      component.pointerDown(
        eventOnBackground(100, 100, { pointerId: 1, pointerType: 'touch' })
      );
      component.pointerMove(
        eventOnBackground(200, 150, { pointerId: 1, pointerType: 'touch' })
      );
      component.pointerDown(
        eventOnBackground(300, 150, { pointerId: 2, pointerType: 'touch' })
      );

      expect(component.planets().length).toBe(planetsBefore);
    });

    /** Presses, drags and releases one finger over the empty background. */
    function dragTouch({
      from,
      to,
    }: {
      from: [number, number];
      to: [number, number];
    }): void {
      const finger = { pointerId: 1, pointerType: 'touch' };
      component.pointerDown(eventOnBackground(from[0], from[1], finger));
      component.pointerMove(eventOnBackground(to[0], to[1], finger));
      component.pointerUp(eventOnBackground(to[0], to[1], finger));
    }

    it('should not center when a new planet is placed on empty space', () => {
      const centerBefore = component.viewCenter();
      const planetsBefore = component.planets().length;

      component.pointerDown(eventOnBackground(100, 100));
      component.pointerUp(eventOnBackground(100, 100));

      expect(component.planets().length).toBe(planetsBefore + 1);
      expect(component.viewCenter()).toEqual(centerBefore);
      expect(component.followedId()).toBeNull();
    });

    it('should not center when the pointer is taken away', () => {
      const planet = component.planets()[0];
      const centerBefore = component.viewCenter();

      component.pointerDown(eventOn(planet.id, 100, 100));
      component.pointerCancel(eventOn(planet.id, 100, 100));

      expect(component.viewCenter()).toEqual(centerBefore);
    });

    it('should center a planet that left the world bounds', () => {
      const planet = component.planets()[0];
      planet.pos = component.canvasSize().add(vec2(500, 400));
      // refresh the planets signal through a public api
      component.step(0);

      component.pointerDown(eventOn(planet.id, 100, 100));
      component.pointerUp(eventOn(planet.id, 100, 100));

      expect(component.viewCenter()).toEqual(planet.pos);
    });
  });

  describe('object menu', () => {
    /** Event targeting the svg element of the given world object. */
    function eventOn(id: string, type = 'contextmenu'): MouseEvent {
      const event = new MouseEvent(type, {
        clientX: 120,
        clientY: 90,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', {
        value: query(fixture, `[id="${id}"]`)!,
      });
      return event;
    }

    /** Finger resting on the svg element of the given world object. */
    function touchOn(id: string, pointerId = 1): PointerEvent {
      const event = new MouseEvent('pointerdown', {
        clientX: 120,
        clientY: 90,
        cancelable: true,
      });
      Object.defineProperty(event, 'pointerId', { value: pointerId });
      Object.defineProperty(event, 'pointerType', { value: 'touch' });
      Object.defineProperty(event, 'target', {
        value: query(fixture, `[id="${id}"]`)!,
      });
      return event as PointerEvent;
    }

    beforeEach(() => jest.useFakeTimers());

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should open the menu of a planet on right click', () => {
      const planet = component.planets()[0];
      const event = eventOn(planet.id);

      component.contextMenu(event);

      expect(component.menuTarget()).toBe(planet);
      expect(component.menuPosition()).toEqual({ x: 120, y: 90 });
      // the browser menu must not open on top of it
      expect(event.defaultPrevented).toBe(true);
    });

    it('should leave the browser menu alone off the objects', () => {
      // the empty svg background carries no id, so it is no world object
      const event = new MouseEvent('contextmenu', { cancelable: true });
      Object.defineProperty(event, 'target', {
        value: query(fixture, 'svg')!,
      });

      component.contextMenu(event);

      expect(component.menuTarget()).toBeNull();
      expect(event.defaultPrevented).toBe(false);
    });

    it('should pause the simulation while the menu is open', () => {
      component.toggleSim();
      expect(component.running()).toBe(true);

      component.contextMenu(eventOn(component.planets()[0].id));

      expect(component.running()).toBe(false);
    });

    it('should open the menu after a long touch', () => {
      const planet = component.planets()[0];

      const forcesBefore = component.worldService.getForces().length;

      component.pointerDown(touchOn(planet.id));
      expect(component.menuTarget()).toBeNull();
      jest.advanceTimersByTime(500);

      expect(component.menuTarget()).toBe(planet);
      expect(component.menuPosition()).toEqual({ x: 120, y: 90 });
      // the planet is let go of, so lifting the finger does not fling it
      expect(component.worldService.getForces().length).toBe(forcesBefore);
    });

    it('should not open the menu when the touch ends early', () => {
      component.pointerDown(touchOn(component.planets()[0].id));
      component.pointerUp(touchOn(component.planets()[0].id));
      jest.advanceTimersByTime(500);

      expect(component.menuTarget()).toBeNull();
    });

    it('should not open the menu when a mouse rests on an object', () => {
      const press = eventOn(component.planets()[0].id, 'mousedown');
      Object.defineProperty(press, 'pointerId', { value: 1 });
      Object.defineProperty(press, 'pointerType', { value: 'mouse' });

      component.pointerDown(press as PointerEvent);
      jest.advanceTimersByTime(500);

      expect(component.menuTarget()).toBeNull();
    });

    it('should leave the gestures alone on a right click', () => {
      const planet = component.planets()[0];
      const centerBefore = component.viewCenter();
      const forcesBefore = component.worldService.getForces().length;
      const planetsBefore = component.planets().length;

      // a right click both opens the menu and reaches mouseDown; the overlay
      // backdrop then swallows the pointerup that would unwind a gesture
      const press = eventOn(planet.id, 'mousedown');
      Object.defineProperty(press, 'button', { value: 2 });
      component.pointerDown(press as PointerEvent);

      expect(component.worldService.getForces().length).toBe(forcesBefore);
      expect(component.planets().length).toBe(planetsBefore);
      expect(component.followedId()).toBeNull();
      component.pointerMove(eventOn(planet.id, 'mousemove') as PointerEvent);
      expect(component.viewCenter()).toEqual(centerBefore);
    });

    it('should not start a pan on a right click with a modifier', () => {
      const centerBefore = component.viewCenter();
      const press = eventOn(component.planets()[0].id, 'mousedown');
      Object.defineProperty(press, 'button', { value: 2 });
      Object.defineProperty(press, 'shiftKey', { value: true });

      component.pointerDown(press as PointerEvent);
      component.pointerMove(pointerEvent(0, 0, { shiftKey: true }));

      expect(component.viewCenter()).toEqual(centerBefore);
    });

    it('should pick the simulation back up when the menu closes', () => {
      component.toggleSim();
      component.contextMenu(eventOn(component.planets()[0].id));
      expect(component.running()).toBe(false);

      component.menuClosed();

      expect(component.running()).toBe(true);
    });

    it('should leave a paused simulation paused', () => {
      component.contextMenu(eventOn(component.planets()[0].id));
      component.menuClosed();
      expect(component.running()).toBe(false);
    });

    it('should not change the speed of the static sun', () => {
      component.contextMenu(eventOn(component.sun.id));

      component.setSpeed(400);

      expect(component.sun.vel).toEqual(vec2(0, 0));
    });

    it('should not let a satellite inherit the speed of a static sun', () => {
      component.sun.vel = vec2(400, 0);
      component.contextMenu(eventOn(component.sun.id));

      component.addSatellite();

      const satellite = component.planets()[component.planets().length - 1];
      // the orbital speed only, nothing carried over from the static sun
      expect(satellite.vel.length()).toBeLessThan(100);
    });

    it('should keep the mass slider within its scale', () => {
      component.settings.update((settings) => ({
        ...settings,
        massOfSun: 500000,
      }));
      fixture.detectChanges();

      component.contextMenu(eventOn(component.sun.id));

      // the slider cannot show that mass, but the label still tells the truth
      expect(component.menuMassExponent()).toBe(MAX_MASS_EXPONENT);
      expect(component.menuMass()).toBe(500000);
    });

    it('should open no menu at all once a second finger joins', () => {
      const [first, second] = component.planets();

      component.pointerDown(touchOn(first.id));
      component.pointerDown(touchOn(second.id, 2));
      jest.advanceTimersByTime(500);

      // two fingers are a pinch, and a pinch is not a long press
      expect(component.menuTarget()).toBeNull();
    });

    it('should forget the target when the menu closes', () => {
      component.contextMenu(eventOn(component.planets()[0].id));
      component.menuClosed();
      expect(component.menuTarget()).toBeNull();
    });

    it('should describe a satellite of the sun as a planet', () => {
      component.contextMenu(eventOn(component.sun.id));
      expect(component.satelliteName()).toBe('planet');

      component.contextMenu(eventOn(component.planets()[0].id));
      expect(component.satelliteName()).toBe('moon');
    });

    it('should add a satellite in orbit around the menu target', () => {
      const parent = component.planets()[0];
      component.contextMenu(eventOn(parent.id));
      const planetsBefore = component.planets().length;

      component.addSatellite();

      expect(component.planets().length).toBe(planetsBefore + 1);
      const satellite = component
        .planets()
        .find((p) => !p.trail.length && p !== parent && p.mass < parent.mass)!;
      const distance = satellite.pos.dist(parent.pos);
      // the discs must not overlap, and the moon must stay in reach of its
      // planet: with these masses the hill radius is the tighter of the two
      expect(distance).toBeGreaterThanOrEqual(parent.radius + satellite.radius);
      expect(distance).toBeLessThanOrEqual(parent.radius * 4);
      const hill =
        parent.pos.dist(component.sun.pos) *
        Math.cbrt(parent.mass / component.sun.mass);
      expect(distance).toBeLessThanOrEqual(hill * 0.4 + 1e-9);
      // the speed of a circular orbit, on top of the parent's own travel and
      // slowed down for the pairs the satellite has with the sun and the two
      // planets that were already there
      const pairs = 3;
      const orbitSpeed = Math.sqrt(
        (component.settings().gravitationalConstant * parent.mass) /
          (pairs * distance)
      );
      expect(satellite.vel.sub(parent.vel).length()).toBeCloseTo(orbitSpeed, 6);
    });

    it('should not add anything without a menu target', () => {
      const planetsBefore = component.planets().length;
      component.addSatellite();
      expect(component.planets().length).toBe(planetsBefore);
    });

    it('should change the mass of a planet from the slider', () => {
      const planet = component.planets()[0];
      component.contextMenu(eventOn(planet.id));

      component.setMassExponent(3);

      expect(planet.mass).toBe(1000);
      expect(component.menuMass()).toBe(1000);
      // the slider shows the mass it is set to
      expect(component.menuMassExponent()).toBeCloseTo(3, 6);
    });

    it('should change the mass of the sun through the settings', () => {
      component.contextMenu(eventOn(component.sun.id));

      component.setMassExponent(4);
      fixture.detectChanges();

      expect(component.settings().massOfSun).toBe(10000);
      expect(component.sun.mass).toBe(10000);
    });

    it('should change the speed of a planet, keeping its direction', () => {
      const planet = component.planets()[0];
      const direction = planet.vel.norm();
      component.contextMenu(eventOn(planet.id));

      component.setSpeed(250);

      expect(planet.vel.length()).toBeCloseTo(250, 6);
      expect(planet.vel.norm().x).toBeCloseTo(direction.x, 6);
      expect(planet.vel.norm().y).toBeCloseTo(direction.y, 6);
    });

    it('should send a resting object onto an orbit around the sun', () => {
      const planet = component.planets()[0];
      planet.vel = vec2(0, 0);
      component.contextMenu(eventOn(planet.id));

      component.setSpeed(120);

      expect(planet.vel.length()).toBeCloseTo(120, 6);
      // an orbit runs perpendicular to the line towards the sun
      const towardsSun = planet.pos.sub(component.sun.pos).norm();
      expect(towardsSun.scalar(planet.vel.norm())).toBeCloseTo(0, 6);
    });

    it('should not let the speed exceed what the simulation allows', () => {
      const planet = component.planets()[0];
      component.contextMenu(eventOn(planet.id));

      component.setSpeed(99999);

      expect(planet.vel.length()).toBeCloseTo(MAX_SPEED, 6);
    });
  });

  describe('planet trails', () => {
    /** Advances the simulation by the given number of frames. */
    function runFrames(frames: number): void {
      for (let frame = 0; frame < frames; frame++) {
        component.step(1 / 60);
      }
    }

    it('should not show a trail before anything moved', () => {
      expect(component.trailSegments()).toEqual([]);
    });

    it('should show a trail behind the planets while running', () => {
      runFrames(60);

      const planet = component.planets()[0];
      const segments = component
        .trailSegments()
        .filter((segment) => segment.id.startsWith(planet.id));
      expect(segments.length).toBeGreaterThan(1);
      expect(segments[0].color).toBe(planet.color);
      // the tail fades and tapers towards its oldest end
      const newest = segments[segments.length - 1];
      expect(segments[0].opacity).toBeLessThan(newest.opacity);
      expect(segments[0].width).toBeLessThan(newest.width);
    });

    it('should render the trail behind the planets', () => {
      runFrames(60);
      fixture.detectChanges();

      const svg = query<SVGSVGElement>(fixture, 'svg')!;
      const drawn = Array.from(svg.querySelectorAll('g > *'));
      const lastTrail = drawn.map((el) =>
        el.classList.contains('planet-trail')
      );
      expect(lastTrail.filter(Boolean).length).toBe(
        component.trailSegments().length
      );
      const firstPlanet = drawn.findIndex((el) =>
        el.classList.contains('world-object')
      );
      expect(lastTrail.lastIndexOf(true)).toBeLessThan(firstPlanet);
    });

    it('should hide the trail when switched off', () => {
      runFrames(60);
      expect(component.trailSegments().length).toBeGreaterThan(0);

      component.settings.update((settings) => ({
        ...settings,
        showTrail: false,
      }));
      expect(component.trailSegments()).toEqual([]);
    });

    it('should not show more trail than configured', () => {
      runFrames(120);
      const longTrail = component.trailSegments();

      component.settings.update((settings) => ({
        ...settings,
        trailLength: 12,
      }));
      const shortTrail = component.trailSegments();

      expect(countPoints(shortTrail)).toBeLessThan(countPoints(longTrail));
      // every planet contributes at most 12 points, segments overlap by one
      expect(countPoints(shortTrail)).toBeLessThanOrEqual(
        component.planets().length * 12 + shortTrail.length
      );
    });

    /** Number of points drawn by all given trail segments together. */
    function countPoints(segments: { path: string }[]): number {
      return segments.reduce(
        (sum, { path }) => sum + path.split(/[ML]/).length - 1,
        0
      );
    }
  });
});

/**
 * Pointer event at the given client position, e.g. `{ shiftKey: true }` to pan
 * or `{ pointerType: 'touch', pointerId: 2 }` for a second finger. jsdom has no
 * PointerEvent, so a MouseEvent carries the pointer properties instead.
 */
function pointerEvent(
  clientX: number,
  clientY: number,
  init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}
): PointerEvent {
  const { pointerId = 1, pointerType = 'mouse', ...mouseInit } = init;
  const event = new MouseEvent('pointerdown', {
    clientX,
    clientY,
    ...mouseInit,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event as PointerEvent;
}

/** Wheel event at the given client position; a negative `deltaY` zooms in. */
function wheelEvent(
  deltaY: number,
  clientX: number,
  clientY: number
): WheelEvent {
  return new WheelEvent('wheel', {
    deltaY,
    clientX,
    clientY,
    cancelable: true,
  });
}
