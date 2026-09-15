/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { qaSelector } from '@wolsok/test-helper';
import { vec2 } from '@wolsok/utils-math';
import { GravityConfigComponent } from './config/gravity-config.component';
import {
  INITIAL_CONFIG,
  INITIAL_MASS_OF_SUN,
  INITIAL_SHOW_VELOCITY,
  MAX_SIMULATION_SPEED,
} from './domain/gravity-world-config';
import {
  EARTH_MASS,
  GRAVITATIONAL_CONSTANT,
  PLANETS,
} from './domain/solar-system';
import { SPRING_SPEED_PER_AU } from './domain/world-objects/force';
import { Planet } from './domain/world-objects/planet';

// minimal mock service (if needed could be expanded) but we rely on real implementation for now
import {
  GravityWorldComponent,
  MAX_MASS_EXPONENT,
  MAX_TICK_YEARS,
  MAX_TICKS_PER_FRAME,
  MAX_SPEED,
  MAX_ZOOM,
  MIN_MASS_EXPONENT,
  MIN_ZOOM,
  YEARS_PER_SECOND,
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
            gravitationalConstant: GRAVITATIONAL_CONSTANT,
            massOfSun: INITIAL_MASS_OF_SUN,
            showTrail: true,
            showVelocity: INITIAL_SHOW_VELOCITY,
            trailLength: 100,
            simulationSpeed: 1,
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

  describe('velocity arrows', () => {
    it('should draw none of them until they are switched on', () => {
      // the planets are small at this scale and an arrow on each is most of
      // what would be on the screen, so the world starts without them
      expect(INITIAL_SHOW_VELOCITY).toBe(false);
      expect(component.velocitySvgPath()).toEqual([]);
      expect(
        fixture.nativeElement.querySelectorAll('path.line-line').length
      ).toBe(0);
    });

    it('should draw one per planet once they are', () => {
      component.settings.update((settings) => ({
        ...settings,
        showVelocity: true,
      }));
      fixture.detectChanges();

      const arrows = component.velocitySvgPath();
      expect(arrows.length).toBe(component.planets().length);
      expect(arrows.map(({ id }) => id)).toEqual(
        component.planets().map(({ id }) => id)
      );
      expect(
        fixture.nativeElement.querySelectorAll('path.line-line').length
      ).toBe(arrows.length);
    });

    it('should take them away again when switched back off', () => {
      component.settings.update((settings) => ({
        ...settings,
        showVelocity: true,
      }));
      expect(component.velocitySvgPath().length).toBeGreaterThan(0);

      component.settings.update((settings) => ({
        ...settings,
        showVelocity: false,
      }));

      expect(component.velocitySvgPath()).toEqual([]);
    });

    it('should show the spring of a drag whatever the setting says', () => {
      // the arrow a drag draws is what the gesture is doing, not an overlay
      // on the physics, so it is not what this switch is about
      const planet = component.planets()[0];
      component.pointerDown(pointerOn(planet.id, 100, 100));
      component.pointerMove(pointerOn(planet.id, 160, 140));
      fixture.detectChanges();

      expect(component.settings().showVelocity).toBe(false);
      expect(component.forcesSvgPaths().length).toBe(1);
    });

    /** Pointer event on the svg element of the given object. */
    function pointerOn(
      id: string,
      clientX: number,
      clientY: number
    ): PointerEvent {
      const event = new MouseEvent('pointerdown', { clientX, clientY });
      Object.defineProperty(event, 'target', {
        value: Object.assign(document.createElement('div'), { id }),
      });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      return event as PointerEvent;
    }
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
      // six by three point six AU, rounded as the viewBox rounds
      expect(component.viewBox()).toBe('0 0 6 3.6');
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

    it('should start the planets on the gravity that is set', () => {
      component.settings.update((settings) => ({
        ...settings,
        gravitationalConstant: GRAVITATIONAL_CONSTANT * 4,
      }));

      component.reset();

      // the world integrates with the gravity from the settings, so a planet
      // started on the speed the default one would need is not on a circle -
      // four times the gravity is twice the speed
      component.planets().forEach((planet, index) => {
        const distance = planet.pos.dist(component.sun.pos);
        expect(distance).toBeCloseTo(PLANETS[index].orbit, 9);
        expect(planet.vel.length()).toBeCloseTo(
          Math.sqrt(
            (GRAVITATIONAL_CONSTANT * 4 * component.sun.mass) / distance
          ),
          9
        );
      });
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

      // the ring goes on the painted circle, while the id sits on the target
      // the pointer hits
      const marked: NodeListOf<SVGCircleElement> =
        fixture.nativeElement.querySelectorAll('circle.world-object.followed');
      expect(marked.length).toBe(1);
      expect(marked[0].getAttribute('cx')).toBe(`${planet.pos.x}`);
      expect(query(fixture, 'circle.sun')?.classList.contains('followed')).toBe(
        false
      );
    });

    it('should give every body a touch target over its own place', () => {
      const bodies = [...component.planets(), component.sun];

      // a planet is a few pixels across, far less than a finger, so what
      // answers the pointer is a circle of its own - see the stylesheet
      bodies.forEach((body) => {
        const target = query<SVGCircleElement>(fixture, `[id="${body.id}"]`);
        expect(target?.classList.contains('touch-target')).toBe(true);
        expect(target?.getAttribute('cx')).toBe(`${body.pos.x}`);
        expect(target?.getAttribute('cy')).toBe(`${body.pos.y}`);
      });
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
      // 2.4 AU, and every AU of stretch is worth SPRING_SPEED_PER_AU
      expect(planet.vel.x).toBeLessThan(0);
      expect(Math.abs(planet.vel.y)).toBeLessThan(1e-9);
      expect(planet.vel.length()).toBeCloseTo(2.4 * SPRING_SPEED_PER_AU, 6);
    });

    it('should throw as far as the gesture stretched the spring', () => {
      const planet = placePlanetUnder(300, 150);

      component.pointerDown(eventOn(planet.id, 300, 150));
      component.pointerMove(eventOn(planet.id, 350, 150));
      component.pointerUp(eventOn(planet.id, 350, 150));

      // 50px of a 500px wide view is 0.6 AU of a 6 AU wide world, and the
      // spring hands over its stretch times SPRING_SPEED_PER_AU
      expect(planet.vel.x).toBeCloseTo(0.6 * SPRING_SPEED_PER_AU, 6);
      expect(planet.vel.y).toBeCloseTo(0, 6);
    });

    /** Moves the first planet to rest exactly under the given client point. */
    function placePlanetUnder(clientX: number, clientY: number): Planet {
      const planet = component.planets()[0];
      // the whole world is on screen, so client maps to world by the ratio of
      // the two: 6 AU over 500px across and 3.6 AU over 300px down
      planet.pos = vec2((clientX / 500) * 6, (clientY / 300) * 3.6);
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

    it('should size a placed planet by the mass of the sun', () => {
      const massesFor = (massOfSun: number): number[] => {
        component.reset();
        component.settings.update((settings) => ({ ...settings, massOfSun }));
        fixture.detectChanges();
        const before = component.planets().length;
        for (let i = 0; i < 10; i++) {
          component.pointerDown(eventOnBackground(100 + i * 10, 100));
          component.pointerUp(eventOnBackground(100 + i * 10, 100));
        }
        return component
          .planets()
          .slice(before)
          .map((planet) => planet.mass);
      };

      // a thousand times apart, which is more than the range of masses one
      // sun can hand out - so the two sets cannot overlap whatever is drawn
      const lightSun = massesFor(0.1);
      const heavySun = massesFor(100);

      // every planet of the heavy sun outweighs every planet of the light one
      expect(Math.max(...lightSun)).toBeLessThan(Math.min(...heavySun));
      // and each one stays a planet next to its sun, never a rival
      expect(Math.max(...heavySun)).toBeLessThan(100 / 100);
    });

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
    /**
     * Mars, the planet the world starts with that is furthest out. Far enough
     * from the sun that, once made heavy, it reaches past its own disc and has
     * a range of orbits to offer a moon.
     */
    function outermostPlanet(): Planet {
      return component.planets()[PLANETS.length - 1];
    }

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

    it('should swallow the click that lifting the finger turns into', () => {
      component.pointerDown(touchOn(component.planets()[0].id));
      jest.advanceTimersByTime(500);
      component.pointerUp(touchOn(component.planets()[0].id));

      // the browser fires it a moment later, at the point the finger was -
      // which is the backdrop of the menu that has just opened
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const reached = jest.fn();
      document.addEventListener('click', reached);
      document.body.dispatchEvent(click);
      document.removeEventListener('click', reached);

      expect(reached).not.toHaveBeenCalled();
      expect(click.defaultPrevented).toBe(true);
    });

    it('should swallow only that one click', () => {
      component.pointerDown(touchOn(component.planets()[0].id));
      jest.advanceTimersByTime(500);
      component.pointerUp(touchOn(component.planets()[0].id));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const later = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const reached = jest.fn();
      document.addEventListener('click', reached);
      document.body.dispatchEvent(later);
      document.removeEventListener('click', reached);

      expect(reached).toHaveBeenCalled();
    });

    it('should stop waiting for a click that never comes', () => {
      component.pointerDown(touchOn(component.planets()[0].id));
      jest.advanceTimersByTime(500);
      component.pointerUp(touchOn(component.planets()[0].id));

      // long past anything the browser could still be turning into a click
      jest.advanceTimersByTime(2000);
      const later = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const reached = jest.fn();
      document.addEventListener('click', reached);
      document.body.dispatchEvent(later);
      document.removeEventListener('click', reached);

      expect(reached).toHaveBeenCalled();
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

    it('should offer the default distance as the orbit of the next satellite', () => {
      component.contextMenu(eventOn(component.sun.id));

      const { min, max } = component.orbitRange();
      expect(min).toBeLessThan(max);
      expect(component.menuOrbit()).toBeGreaterThanOrEqual(min);
      expect(component.menuOrbit()).toBeLessThanOrEqual(max);
    });

    it('should offer a real planet the one distance it can hold', () => {
      // what real masses cost this world: a planet is drawn far wider than
      // its grip reaches, so its disc decides and there is nothing to choose.
      // Raising its mass is what opens the range up.
      component.contextMenu(eventOn(component.planets()[0].id));

      const { min, max } = component.orbitRange();
      expect(min).toBe(max);
      expect(component.menuOrbit()).toBe(min);
    });

    it('should place the satellite at the distance the slider is set to', () => {
      component.contextMenu(eventOn(component.sun.id));
      const { min, max } = component.orbitRange();
      const wanted = (min + max) / 2;

      component.setOrbitDistance(wanted);
      component.addSatellite();

      const satellite = component.planets()[component.planets().length - 1];
      expect(satellite.pos.dist(component.sun.pos)).toBeCloseTo(wanted, 6);
    });

    it('should keep the orbit within the range the target allows', () => {
      component.contextMenu(eventOn(component.sun.id));
      const { min, max } = component.orbitRange();

      component.setOrbitDistance(max * 10);
      expect(component.menuOrbit()).toBe(max);

      component.setOrbitDistance(0);
      expect(component.menuOrbit()).toBe(min);
    });

    it('should widen the orbit range with the mass of the target', () => {
      component.contextMenu(eventOn(outermostPlanet().id));
      const before = component.orbitRange();

      // a heavier planet holds on to a moon further out
      component.setMassExponent(MAX_MASS_EXPONENT);

      const after = component.orbitRange();
      expect(after.max).toBeGreaterThan(before.max);
      // and far enough out that there is a range to choose from at all
      expect(after.min).toBeLessThan(after.max);
    });

    it('should pull the orbit back in when the target loses mass', () => {
      component.contextMenu(eventOn(outermostPlanet().id));
      component.setMassExponent(MAX_MASS_EXPONENT);
      component.setOrbitDistance(component.orbitRange().max);
      const wideOrbit = component.menuOrbit();

      component.setMassExponent(MIN_MASS_EXPONENT);

      expect(component.menuOrbit()).toBeLessThan(wideOrbit);
      expect(component.menuOrbit()).toBe(component.orbitRange().max);
    });

    it('should follow the sun out when its mass is raised', () => {
      component.contextMenu(eventOn(component.sun.id));
      const before = component.orbitRange();

      component.setMassExponent(MAX_MASS_EXPONENT);

      // a heavier sun is a bigger disc, so its satellites start further out
      expect(component.sun.mass).toBeCloseTo(
        10 ** MAX_MASS_EXPONENT * EARTH_MASS,
        9
      );
      expect(component.orbitRange().min).toBeGreaterThan(before.min);
      expect(component.menuOrbit()).toBeGreaterThanOrEqual(
        component.orbitRange().min
      );
    });

    it('should not offer an orbit the placement would overrule', () => {
      const planet = component.planets()[0];
      component.contextMenu(eventOn(planet.id));

      // a fast parent carries its satellite along, which needs room
      component.setSpeed(MAX_SPEED);
      component.setOrbitDistance(component.orbitRange().min);
      component.addSatellite();

      const satellite = component.planets()[component.planets().length - 1];
      expect(satellite.pos.dist(planet.pos)).toBeCloseTo(
        component.menuOrbit(),
        6
      );
    });

    it('should keep the mass slider within its scale', () => {
      component.settings.update((settings) => ({
        ...settings,
        massOfSun: 10,
      }));
      fixture.detectChanges();

      component.contextMenu(eventOn(component.sun.id));

      // ten suns are millions of earths, past the end of the slider - which
      // stops there, while the label still tells the truth
      expect(component.menuMassExponent()).toBe(MAX_MASS_EXPONENT);
      expect(component.menuMass()).toBe(10 / EARTH_MASS);
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
      const parent = outermostPlanet();
      component.contextMenu(eventOn(parent.id));
      component.setMassExponent(MAX_MASS_EXPONENT);
      const planetsBefore = component.planets().length;
      const wanted = component.menuOrbit();

      component.addSatellite();

      expect(component.planets().length).toBe(planetsBefore + 1);
      const satellite = component.planets()[component.planets().length - 1];
      const distance = satellite.pos.dist(parent.pos);
      // placed where the slider asked for, with the discs clear of each other
      // and inside the reach of its planet
      expect(distance).toBeCloseTo(wanted, 6);
      expect(distance).toBeGreaterThanOrEqual(parent.radius + satellite.radius);
      const hill =
        parent.pos.dist(component.sun.pos) *
        Math.cbrt(parent.mass / component.sun.mass);
      expect(distance).toBeLessThanOrEqual(hill);
      // the speed of a circular orbit, on top of the parent's own travel
      const orbitSpeed = Math.sqrt(
        (component.settings().gravitationalConstant * parent.mass) / distance
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

      // the slider counts in earth masses, the world in solar ones
      expect(planet.mass).toBeCloseTo(1000 * EARTH_MASS, 12);
      expect(component.menuMass()).toBe(1000);
      // the slider shows the mass it is set to
      expect(component.menuMassExponent()).toBeCloseTo(3, 6);
    });

    it('should change the mass of the sun through the settings', () => {
      component.contextMenu(eventOn(component.sun.id));

      component.setMassExponent(4);
      fixture.detectChanges();

      expect(component.settings().massOfSun).toBeCloseTo(
        10000 * EARTH_MASS,
        12
      );
      expect(component.sun.mass).toBeCloseTo(10000 * EARTH_MASS, 12);
    });

    it('should change the speed of a planet, keeping its direction', () => {
      const planet = component.planets()[0];
      const direction = planet.vel.norm();
      component.contextMenu(eventOn(planet.id));

      component.setSpeed(25);

      expect(planet.vel.length()).toBeCloseTo(25, 6);
      expect(planet.vel.norm().x).toBeCloseTo(direction.x, 6);
      expect(planet.vel.norm().y).toBeCloseTo(direction.y, 6);
    });

    it('should send a resting object onto an orbit around the sun', () => {
      const planet = component.planets()[0];
      planet.vel = vec2(0, 0);
      component.contextMenu(eventOn(planet.id));

      component.setSpeed(12);

      expect(planet.vel.length()).toBeCloseTo(12, 6);
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

  describe('distance of a moon from its planet', () => {
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

    /**
     * Gives the outermost planet enough mass to hold a moon, adds one, and
     * renders it - so it can be found by id like any other world object.
     */
    function addMoonToOutermostPlanet(): { planet: Planet; moon: Planet } {
      const planet = component.planets()[PLANETS.length - 1];
      component.contextMenu(eventOn(planet.id));
      component.setMassExponent(MAX_MASS_EXPONENT);
      component.addSatellite();
      fixture.detectChanges();
      const moon = component.planets()[component.planets().length - 1];
      return { planet, moon };
    }

    it('should offer no distance slider for the sun, which has no parent', () => {
      component.contextMenu(eventOn(component.sun.id));

      expect(component.parentName()).toBe('');
      expect(component.menuDistanceRange()).toEqual({ min: 0, max: 0 });
    });

    it('should name a planet as what a moon orbits', () => {
      const { moon } = addMoonToOutermostPlanet();
      component.contextMenu(eventOn(moon.id));

      expect(component.parentName()).toBe('planet');
    });

    it('should name the sun as what a planet orbits', () => {
      component.contextMenu(eventOn(component.planets()[0].id));

      expect(component.parentName()).toBe('sun');
    });

    it('should offer a moon a range of distance from its own planet, not the sun', () => {
      const { moon } = addMoonToOutermostPlanet();
      component.contextMenu(eventOn(moon.id));

      // a range checked against the sun instead of the planet would collapse:
      // the moon is far too light next to the sun to hold anything out there
      const { min, max } = component.menuDistanceRange();
      expect(min).toBeLessThan(max);
    });

    it('should move the moon to the distance the slider is set to', () => {
      const { planet, moon } = addMoonToOutermostPlanet();
      component.contextMenu(eventOn(moon.id));
      const { min, max } = component.menuDistanceRange();
      const wanted = (min + max) / 2;

      component.setDistance(wanted);

      expect(moon.pos.dist(planet.pos)).toBeCloseTo(wanted, 6);
      expect(component.menuDistance()).toBeCloseTo(wanted, 6);
    });

    it('should keep the moved moon on a circular orbit around its planet', () => {
      const { planet, moon } = addMoonToOutermostPlanet();
      component.contextMenu(eventOn(moon.id));
      const { max } = component.menuDistanceRange();

      component.setDistance(max);

      const orbitSpeed = Math.sqrt(
        (component.settings().gravitationalConstant * planet.mass) / max
      );
      expect(moon.vel.sub(planet.vel).length()).toBeCloseTo(orbitSpeed, 6);
    });

    it('should move a moon back into a valid orbit if growing its own mass leaves it too close', () => {
      const { planet, moon } = addMoonToOutermostPlanet();
      component.contextMenu(eventOn(moon.id));
      const before = moon.pos.dist(planet.pos);

      // a moon grown this heavy has a disc that no longer clears the planet
      // from where it started - the mass slider alone must not leave it
      // overlapping its planet, nor just report a distance it is not at
      component.setMassExponent(MAX_MASS_EXPONENT);

      const after = moon.pos.dist(planet.pos);
      expect(after).toBeGreaterThan(before);
      expect(after).toBeCloseTo(component.menuDistance(), 6);
      expect(after).toBeCloseTo(component.menuDistanceRange().min, 6);
    });

    it('should leave the moon where it is when a mass change does not crowd it', () => {
      const { planet, moon } = addMoonToOutermostPlanet();
      component.contextMenu(eventOn(moon.id));
      const before = moon.pos;

      // lightening the moon only ever widens the range, never shrinks it past
      // where the moon already sits - nothing here needs moving
      component.setMassExponent(MIN_MASS_EXPONENT);

      expect(moon.pos).toBe(before);
      expect(moon.pos.dist(planet.pos)).toBeCloseTo(
        component.menuDistance(),
        6
      );
    });

    it('should keep the distance within the range the moon allows', () => {
      const { moon } = addMoonToOutermostPlanet();
      component.contextMenu(eventOn(moon.id));
      const { min, max } = component.menuDistanceRange();

      component.setDistance(max * 10);
      expect(component.menuDistance()).toBe(max);

      component.setDistance(0);
      expect(component.menuDistance()).toBe(min);
    });

    it('should move a planet relative to the sun the same way', () => {
      const planet = component.planets()[0];
      component.contextMenu(eventOn(planet.id));
      const { min, max } = component.menuDistanceRange();
      const wanted = (min + max) / 2;

      component.setDistance(wanted);

      expect(planet.pos.dist(component.sun.pos)).toBeCloseTo(wanted, 6);
    });

    it('should do nothing for the sun, which has no parent to move against', () => {
      component.contextMenu(eventOn(component.sun.id));
      const before = component.sun.pos;

      component.setDistance(1);

      expect(component.sun.pos).toBe(before);
    });
  });

  describe('simulation speed', () => {
    /**
     * How far the first planet travels over a second of frames, along its
     * path - the distance from where it started says nothing once it has
     * been round the sun more than once.
     */
    function distanceOverASecond(): number {
      component.reset();
      const planet = component.planets()[0];
      let travelled = 0;
      let last = planet.pos;
      for (let frame = 0; frame < 60; frame++) {
        component.step(1 / 60);
        travelled += planet.pos.dist(last);
        last = planet.pos;
      }
      return travelled;
    }

    function setSpeed(simulationSpeed: number): void {
      component.settings.update((settings) => ({
        ...settings,
        simulationSpeed,
      }));
    }

    it('should cover more world in a frame the faster it runs', () => {
      setSpeed(1);
      const normal = distanceOverASecond();

      setSpeed(4);
      const fast = distanceOverASecond();

      setSpeed(0.25);
      const slow = distanceOverASecond();

      expect(fast).toBeGreaterThan(normal);
      expect(slow).toBeLessThan(normal);
    });

    it('should keep a planet on its orbit at speed', () => {
      const sunMass = component.sun.mass;
      setSpeed(1);
      component.contextMenu(eventOnSun());
      component.addSatellite();
      const satellite = component.planets()[component.planets().length - 1];
      const orbit = satellite.pos.dist(component.sun.pos);

      setSpeed(MAX_SIMULATION_SPEED);
      for (let frame = 0; frame < 120; frame++) {
        component.step(1 / 60);
      }

      // a frame ten times as wide would have thrown it off the orbit; in
      // slices it stays in the same ring around its unchanged sun
      expect(component.sun.mass).toBe(sunMass);
      expect(satellite.pos.dist(component.sun.pos)).toBeGreaterThan(orbit / 2);
      expect(satellite.pos.dist(component.sun.pos)).toBeLessThan(orbit * 2);
    });

    it('should hold an orbit whatever else is in the world', () => {
      setSpeed(1);
      component.contextMenu(eventOnSun());
      component.addSatellite();
      const satellite = component.planets()[component.planets().length - 1];
      const orbit = satellite.pos.dist(component.sun.pos);
      const speed = satellite.vel.length();

      // the world is moved once per object, not once per pair of them, so
      // emptying it of every other planet leaves this orbit where it was
      component
        .planets()
        .filter((planet) => planet !== satellite)
        .forEach((planet) => component.worldService.removeWorldObject(planet));
      for (let frame = 0; frame < 60; frame++) {
        component.step(1 / 60);
      }

      // the same ring and the same speed it would keep in an empty world
      expect(satellite.pos.dist(component.sun.pos) / orbit).toBeCloseTo(1, 1);
      expect(satellite.vel.length() / speed).toBeCloseTo(1, 1);
    });

    it('should carry a frame at the usual speed whole', () => {
      const tick = jest.spyOn(component.worldService, 'calcNextTick');
      setSpeed(1);

      // a 60Hz frame, and the same frame arriving a little late as they do
      for (const frame of [1 / 60, 1 / 60 + 0.002, 1 / 59]) {
        tick.mockClear();
        component.step(frame);
        const years = frame * YEARS_PER_SECOND;
        // as few slices as the integrator can follow, and not a moment of
        // the frame lost between them
        expect(tick).toHaveBeenCalledTimes(Math.ceil(years / MAX_TICK_YEARS));
        expect(
          tick.mock.calls.every(([dt]) => dt <= MAX_TICK_YEARS + 1e-9)
        ).toBe(true);
        const simulated = tick.mock.calls.reduce((sum, [dt]) => sum + dt, 0);
        expect(simulated).toBeCloseTo(years, 12);
      }
    });

    it('should cut a fast frame into slices', () => {
      const tick = jest.spyOn(component.worldService, 'calcNextTick');
      setSpeed(8);

      component.step(1 / 60);

      // eight times a 60Hz frame is more world time than one slice may hold
      expect(tick.mock.calls.length).toBeGreaterThan(1);
      expect(tick.mock.calls.every(([dt]) => dt <= MAX_TICK_YEARS + 1e-9)).toBe(
        true
      );
      const simulated = tick.mock.calls.reduce((sum, [dt]) => sum + dt, 0);
      expect(simulated).toBeCloseTo((8 / 60) * YEARS_PER_SECOND, 12);
    });

    it('should hold its speed through the frame rates a screen reaches', () => {
      const tick = jest.spyOn(component.worldService, 'calcNextTick');
      setSpeed(MAX_SIMULATION_SPEED);

      // down to 20fps the world still runs at the speed that is asked for
      for (const frame of [1 / 60, 1 / 30, 1 / 20]) {
        tick.mockClear();
        component.step(frame);
        const simulated = tick.mock.calls.reduce((sum, [dt]) => sum + dt, 0);
        expect(simulated).toBeCloseTo(
          frame * MAX_SIMULATION_SPEED * YEARS_PER_SECOND,
          12
        );
      }
    });

    it('should let the world fall behind rather than take a huge step', () => {
      const tick = jest.spyOn(component.worldService, 'calcNextTick');
      setSpeed(MAX_SIMULATION_SPEED);

      // a frame this long only happens when the tab was away for a while
      component.step(10);

      // neither more slices than a frame can afford nor a slice so wide the
      // integrator loses the orbit - the world simply misses that time
      expect(tick.mock.calls.length).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
      expect(tick.mock.calls.every(([dt]) => dt <= MAX_TICK_YEARS + 1e-9)).toBe(
        true
      );
      const simulated = tick.mock.calls.reduce((sum, [dt]) => sum + dt, 0);
      expect(simulated).toBeCloseTo(MAX_TICKS_PER_FRAME * MAX_TICK_YEARS, 9);
    });

    it('should clear a switched off trail once a frame, not once a slice', () => {
      const record = jest.spyOn(component.worldService, 'recordTrails');
      component.settings.update((settings) => ({
        ...settings,
        showTrail: false,
        simulationSpeed: MAX_SIMULATION_SPEED,
      }));

      component.step(1 / 60);

      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(0);
    });

    it('should run at normal speed when the config carries none', () => {
      const tick = jest.spyOn(component.worldService, 'calcNextTick');
      component.settings.update(
        (settings) =>
          ({
            ...settings,
            simulationSpeed: undefined,
          }) as unknown as typeof settings
      );

      component.step(1 / 60);

      const simulated = tick.mock.calls.reduce((sum, [dt]) => sum + dt, 0);
      expect(simulated).toBeCloseTo((1 / 60) * YEARS_PER_SECOND, 12);
    });

    /** Right click on the sun, to open its menu. */
    function eventOnSun(): MouseEvent {
      const event = new MouseEvent('contextmenu', {
        clientX: 10,
        clientY: 10,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', {
        value: query(fixture, `[id="${component.sun.id}"]`)!,
      });
      return event;
    }
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
