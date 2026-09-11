/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { qaSelector } from '@wolsok/test-helper';
import { GravityConfigComponent } from './config/gravity-config.component';
import { INITIAL_CONFIG } from './domain/gravity-world-config';

// minimal mock service (if needed could be expanded) but we rely on real implementation for now
import {
  GravityWorldComponent,
  MAX_ZOOM,
  MIN_ZOOM,
} from './gravity-world.component';

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
      expect(component.zoomPercent()).toBe(100);
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
      ).toBe(`${component.zoomPercent()}%`);

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

      component.mouseDown(mouseEvent(250, 150, { shiftKey: true }));
      component.mouseMove(mouseEvent(200, 150, { shiftKey: true }));

      expect(component.planets().length).toBe(planetsBefore);
      expect(component.viewCenter().x).toBeGreaterThan(centerBefore.x);

      component.mouseUp(mouseEvent(200, 150));
      const centerAfterUp = component.viewCenter();
      component.mouseMove(mouseEvent(100, 150));
      expect(component.viewCenter()).toEqual(centerAfterUp);
    });

    it('should keep the view center inside the world while panning', () => {
      component.mouseDown(mouseEvent(250, 150, { shiftKey: true }));
      component.mouseMove(mouseEvent(-5000, -5000, { shiftKey: true }));
      expect(component.viewCenter().x).toBe(component.canvasSize().x);
      expect(component.viewCenter().y).toBe(component.canvasSize().y);
    });
  });

  describe('planet trails', () => {
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

    function countPoints(segments: { path: string }[]): number {
      return segments.reduce(
        (sum, { path }) => sum + path.split(/[ML]/).length - 1,
        0
      );
    }
  });
});

function mouseEvent(
  clientX: number,
  clientY: number,
  init: MouseEventInit = {}
): MouseEvent {
  return new MouseEvent('mousedown', { clientX, clientY, ...init });
}

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
