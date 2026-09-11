import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  Signal,
  signal,
  TrackByFunction,
  ViewChild,
  WritableSignal,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSliderModule } from '@angular/material/slider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { vec2, Vector2d } from '@wolsok/utils-math';
import { notNil } from '@wolsok/utils-operators';
import { map, Observable, Subject, switchMap, take, takeUntil } from 'rxjs';
import { GravityConfigComponent } from './config/gravity-config.component';
import {
  GravityWorldConfig,
  INITIAL_CONFIG,
} from './domain/gravity-world-config';
import { GravityWorldService } from './domain/gravity-world.service';
import { Force, SpringForce } from './domain/world-objects/force';
import { Planet } from './domain/world-objects/planet';
import {
  defaultOrbitDistance,
  orbitAround,
  satelliteMass,
} from './domain/world-objects/orbit';
import { Sun } from './domain/world-objects/sun';
import { SvgPath, TrailSegment } from './domain/world-objects/svg-path';
import {
  svgPathForVelocity,
  toSvgPath,
  trailToSvgSegments,
} from './domain/world-objects/toSvgPath';
import { MAX_VELOCITY, WorldObject } from './domain/world-objects/world-object';

const SVG_VIEW_PORT_SIZE = 3000;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 20;
const ZOOM_STEP = 1.3;
const WHEEL_ZOOM_STEP = 1.15;
const TRAIL_WIDTH_RATIO = 0.8;
/** How far the cursor may travel between press and release to still be a click. */
const CLICK_TOLERANCE_PX = 4;
/** How long a touch has to rest on an object to open its menu. */
const LONG_PRESS_MS = 450;

export const MIN_MASS_EXPONENT = 1;
export const MAX_MASS_EXPONENT = 5;
export const MAX_SPEED = MAX_VELOCITY;

@Component({
  selector: 'feat-lazy-gravity-world',
  templateUrl: 'gravity-world.component.html',
  styleUrls: ['gravity-world.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
    MatIconModule,
    MatTooltipModule,
    GravityConfigComponent,
    MatSidenavModule,
    MatMenuModule,
    MatSliderModule,
  ],
})
export class GravityWorldComponent {
  readonly worldService = inject(GravityWorldService);
  private readonly initialConfig = inject<GravityWorldConfig>(INITIAL_CONFIG);

  public MAX_DIM: Vector2d = Vector2d.create(
    SVG_VIEW_PORT_SIZE,
    (SVG_VIEW_PORT_SIZE / 5) * 3
  );

  @ViewChild('svgWorld')
  svgWorld!: ElementRef<SVGSVGElement>;

  @ViewChild(MatMenuTrigger)
  objectMenu!: MatMenuTrigger;

  settings: WritableSignal<GravityWorldConfig>;

  public running = signal(false);
  sun!: Sun;
  planets: WritableSignal<Planet[]> = signal([]);

  forces: WritableSignal<Force[]> = signal([]);
  forcesSvgPaths: Signal<SvgPath[]> = computed(() =>
    this.forces()
      .map((f) => toSvgPath(f))
      .filter(notNil)
  );

  velocitySvgPath: Signal<SvgPath[]> = computed(() =>
    this.planets().map((planet) =>
      svgPathForVelocity(planet.id, planet.pos, planet.vel)
    )
  );

  canvasSize: WritableSignal<Vector2d> = signal(this.MAX_DIM);

  /** Zoom factor of the viewport, 1 shows the whole world. */
  readonly zoom: WritableSignal<number> = signal(1);
  /** World coordinate that sits in the middle of the viewport. */
  readonly viewCenter: WritableSignal<Vector2d> = signal(this.MAX_DIM.div(2));

  private readonly viewSize: Signal<Vector2d> = computed(() =>
    this.canvasSize().div(this.zoom())
  );

  /**
   * Area the view may be centered on: the world, grown to cover every planet.
   * Planets can be flung out of the world, and they should stay reachable.
   */
  private readonly viewBounds: Signal<{ min: Vector2d; max: Vector2d }> =
    computed(() => {
      const world: Vector2d = this.canvasSize();
      let min: Vector2d = vec2(0, 0);
      let max: Vector2d = world;
      for (const { pos } of this.planets()) {
        min = vec2(Math.min(min.x, pos.x), Math.min(min.y, pos.y));
        max = vec2(Math.max(max.x, pos.x), Math.max(max.y, pos.y));
      }
      return { min, max };
    });

  readonly viewBox: Signal<string> = computed(() => {
    const size: Vector2d = this.viewSize();
    const origin: Vector2d = this.viewCenter().sub(size.div(2));
    return [origin.x, origin.y, size.x, size.y]
      .map((value) => Math.round(value * 100) / 100)
      .join(' ');
  });

  /** World object the view sticks to while the simulation runs, if any. */
  private readonly followed: WritableSignal<WorldObject | null> = signal(null);
  /** Id of the followed object, for the template. */
  readonly followedId: Signal<string | null> = computed(
    () => this.followed()?.id ?? null
  );

  readonly zoomPercent: Signal<number> = computed(() =>
    Math.round(this.zoom() * 100)
  );
  readonly canZoomIn: Signal<boolean> = computed(() => this.zoom() < MAX_ZOOM);
  readonly canZoomOut: Signal<boolean> = computed(() => this.zoom() > MIN_ZOOM);

  /** Trail chunks of all planets, oldest and faintest first. */
  readonly trailSegments: Signal<TrailSegment[]> = computed(() => {
    const { showTrail, trailLength } = this.settings();
    if (!showTrail) {
      return [];
    }
    return this.planets().flatMap((planet) =>
      trailToSvgSegments(
        planet.id,
        planet.trail.slice(-trailLength),
        planet.color,
        planet.radius * TRAIL_WIDTH_RATIO
      )
    );
  });

  private mouseDown$: Subject<MouseEvent> = new Subject();
  private mouseMove$: Subject<MouseEvent> = new Subject();
  private mouseUp$: Subject<MouseEvent> = new Subject();

  private panStart: { x: number; y: number; center: Vector2d } | null = null;

  /** World object whose menu is open, and where the menu is anchored. */
  readonly menuTarget: WritableSignal<WorldObject | null> = signal(null);
  readonly menuPosition: WritableSignal<{ x: number; y: number }> = signal({
    x: 0,
    y: 0,
  });

  /**
   * Mass of the menu target on a log scale, so every size is reachable. The
   * sliders own this state - the world objects are mutable, a signal reading
   * their fields would not notice a change.
   */
  readonly menuMassExponent: WritableSignal<number> = signal(MIN_MASS_EXPONENT);
  readonly menuMass: Signal<number> = computed(() =>
    Math.round(10 ** this.menuMassExponent())
  );
  readonly menuSpeed: WritableSignal<number> = signal(0);
  /** What a satellite of the menu target would be: a planet, or a moon. */
  readonly satelliteName: Signal<string> = computed(() =>
    this.menuTarget() === this.sun ? 'planet' : 'moon'
  );

  readonly minMassExponent = MIN_MASS_EXPONENT;
  readonly maxMassExponent = MAX_MASS_EXPONENT;
  readonly maxSpeed = MAX_SPEED;

  /** World object pressed on, and where it was pressed, until the mouse is released. */
  private pressed: { wo: WorldObject; x: number; y: number } | null = null;

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  drag$: Observable<{ end: Vector2d }> = this.mouseDown$.asObservable().pipe(
    take(1),
    switchMap(() =>
      this.mouseMove$.asObservable().pipe(
        map((mm: MouseEvent) => ({
          end: this.toWorldCoordinates(mm),
        })),
        takeUntil(this.mouseUp$.asObservable())
      )
    )
  );

  trackByPlanet: TrackByFunction<Planet> = (index, planet) => planet.pos;

  constructor() {
    this.settings = signal(this.initialConfig);
    this.initializeSunAndPlanets();
    this.updateSignals();

    effect(() => {
      this.worldService.setUniverse(
        this.canvasSize().x,
        this.canvasSize().y,
        this.settings().gravitationalConstant
      );
    });
    effect(() => (this.sun.mass = this.settings().massOfSun));
    effect(() => (this.running() ? this.gameLoop() : null));
  }

  private initializeSunAndPlanets(): void {
    this.sun = new Sun(
      this.calcCenteredVec(),
      undefined,
      this.settings().massOfSun
    );

    this.worldService.addWorldObject(this.sun);

    this.worldService.addWorldObject(
      new Planet(this.calcCenteredVec(vec2(0, 450)), vec2(-100, 0), 1000)
    );
    const planet2Pos: Vector2d = vec2(-300, -250);
    this.worldService.addWorldObject(
      new Planet(
        this.calcCenteredVec(planet2Pos),
        planet2Pos.orthogonalTo(this.sun.pos).mul(100),
        2000
      )
    );
    this.updateSignals();
  }

  private calcCenteredVec(vec: Vector2d = vec2(0, 0)): Vector2d {
    return this.canvasSize().div(2).add(vec);
  }

  private updateSignals(): void {
    this.planets.set(
      this.worldService
        .getWorldObjects()
        .filter((wo) => wo instanceof Planet) as Array<Planet>
    );
    this.forces.set(this.worldService.getForces());
  }

  private findWorldObject(target: SVGElement): WorldObject | undefined {
    return this.worldService
      .getWorldObjects()
      .find((wo) => wo.id === target.id);
  }

  /**
   * Starts panning, or grabs the world object under the cursor with a spring -
   * creating a new planet first when the cursor is on empty space. Releasing
   * without dragging centers the object that was pressed on.
   */
  mouseDown($event: MouseEvent): void {
    if (this.isPanGesture($event)) {
      this.startPan($event);
      return;
    }
    let wo = this.findWorldObject($event.target as SVGElement);
    if (wo) {
      this.pressed = { wo, x: $event.clientX, y: $event.clientY };
    } else {
      // a click on empty space places a planet, it does not move the view
      wo = this.createRandomPlanetAt(this.toWorldCoordinates($event));
      this.worldService.addWorldObject(wo);
    }
    const springForce = new SpringForce(wo);
    this.worldService.addForceObject(springForce);
    this.updateSignals();

    this.drag$.subscribe({
      next: ({ end }) => springForce.updateSpringEnd(end),

      error: (error) => {
        console.error('error while dragging', error);
        this.removeForce(springForce);
      },
      complete: () => this.removeForce(springForce),
    });
    this.mouseDown$.next($event);
  }

  private removeForce(springForce: SpringForce): void {
    this.worldService.removeForceObject(springForce);
    this.updateSignals();
  }

  /** Ends the current pan or drag gesture, following a clicked object. */
  mouseUp($event: MouseEvent): void {
    const pressed = this.pressed;
    this.panStart = null;
    this.pressed = null;
    this.mouseUp$.next($event);
    if (pressed && this.isWithinClickTolerance(pressed, $event)) {
      this.toggleFollow(pressed.wo);
    }
  }

  /** Ends the gesture without following, the cursor left the world. */
  mouseLeave($event: MouseEvent): void {
    this.pressed = null;
    this.mouseUp($event);
  }

  /** Moves the view while panning, otherwise feeds the drag gesture. */
  mouseMove($event: MouseEvent): void {
    if (this.panStart) {
      this.pan($event);
      return;
    }
    if (this.pressed && !this.isWithinClickTolerance(this.pressed, $event)) {
      // the gesture has become a drag, releasing it must not center anything,
      // not even when the cursor comes back to where it started
      this.pressed = null;
    }
    this.mouseMove$.next($event);
  }

  /** Zooms towards the cursor, so the world point under it stays in place. */
  wheel($event: WheelEvent): void {
    if ($event.deltaY === 0) {
      return;
    }
    $event.preventDefault();
    const factor: number =
      $event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
    // keep the world point under the cursor in place while zooming - unless an
    // object is followed, then zoom around that instead of losing it
    const focus: Vector2d = this.followed()
      ? this.viewCenter()
      : this.toWorldCoordinates($event);
    this.zoomBy(factor, focus);
  }

  /** Zooms one step in around the center of the current view. */
  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  /** Zooms one step out around the center of the current view. */
  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  /** Shows the whole world again, centered, unzoomed and following nothing. */
  resetView(): void {
    this.stopFollowing();
    this.zoom.set(1);
    this.viewCenter.set(this.canvasSize().div(2));
  }

  /** Zooms by `factor`, keeping `focus` (world coordinates) on the same spot. */
  private zoomBy(factor: number, focus: Vector2d = this.viewCenter()): void {
    const currentZoom: number = this.zoom();
    const nextZoom: number = clamp(currentZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === currentZoom) {
      return;
    }
    this.zoom.set(nextZoom);
    this.viewCenter.set(
      this.clampToViewBounds(
        focus.add(
          this.viewCenter()
            .sub(focus)
            .mul(currentZoom / nextZoom)
        )
      )
    );
  }

  /** Panning is the middle mouse button, or a drag with a modifier held. */
  private isPanGesture($event: MouseEvent): boolean {
    return (
      $event.button === 1 || $event.shiftKey || $event.ctrlKey || $event.metaKey
    );
  }

  /** Remembers where the pan gesture started, in client and world coordinates. */
  private startPan($event: MouseEvent): void {
    $event.preventDefault();
    // panning is manual control, it wins over following
    this.stopFollowing();
    this.panStart = {
      x: $event.clientX,
      y: $event.clientY,
      center: this.viewCenter(),
    };
  }

  /** Moves the view center by the distance the cursor travelled since `startPan`. */
  private pan($event: MouseEvent): void {
    const panStart = this.panStart;
    const rect: DOMRect | undefined = this.svgRect();
    if (!panStart || !rect?.width || !rect.height) {
      return;
    }
    const size: Vector2d = this.viewSize();
    const moved: Vector2d = vec2(
      (($event.clientX - panStart.x) / rect.width) * size.x,
      (($event.clientY - panStart.y) / rect.height) * size.y
    );
    this.viewCenter.set(this.clampToViewBounds(panStart.center.sub(moved)));
  }

  /**
   * Follows the given object, or lets go of it when it is already followed.
   * The view stays where it is when following ends.
   */
  private toggleFollow(wo: WorldObject): void {
    if (this.followed() === wo) {
      this.stopFollowing();
      return;
    }
    this.followed.set(wo);
    this.centerOn(wo);
  }

  /** Lets go of the followed object, leaving the view where it is. */
  stopFollowing(): void {
    this.followed.set(null);
  }

  /** Moves the view so the given object sits in the middle of it. */
  private centerOn(wo: WorldObject): void {
    this.viewCenter.set(this.clampToViewBounds(wo.pos));
  }

  /** Whether the cursor is still (almost) on the spot it was pressed down on. */
  private isWithinClickTolerance(
    pressed: { x: number; y: number },
    $event: MouseEvent
  ): boolean {
    return (
      Math.abs($event.clientX - pressed.x) <= CLICK_TOLERANCE_PX &&
      Math.abs($event.clientY - pressed.y) <= CLICK_TOLERANCE_PX
    );
  }

  /** Keeps the given view center within the reachable area of the world. */
  private clampToViewBounds({ x, y }: Vector2d): Vector2d {
    const { min, max } = this.viewBounds();
    return vec2(clamp(x, min.x, max.x), clamp(y, min.y, max.y));
  }

  /** Opens the menu of the object under the cursor on a right click. */
  contextMenu($event: MouseEvent): void {
    const wo: WorldObject | undefined = this.findWorldObject(
      $event.target as SVGElement
    );
    if (!wo) {
      return;
    }
    $event.preventDefault();
    this.openMenuFor(wo, $event.clientX, $event.clientY);
  }

  /** A touch resting on an object opens its menu, like a right click. */
  touchStart($event: TouchEvent): void {
    const touch: Touch | undefined = $event.touches[0];
    const wo: WorldObject | undefined = this.findWorldObject(
      $event.target as SVGElement
    );
    if (!touch || !wo) {
      return;
    }
    const { clientX, clientY } = touch;
    this.longPressTimer = setTimeout(
      () => this.openMenuFor(wo, clientX, clientY),
      LONG_PRESS_MS
    );
  }

  /** A moving or ending touch is a drag or a tap, not a long press. */
  cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private openMenuFor(wo: WorldObject, x: number, y: number): void {
    this.cancelLongPress();
    // a menu on a moving object would run away from what it acts on
    this.stopSim();
    this.menuTarget.set(wo);
    this.menuPosition.set({ x, y });
    this.menuMassExponent.set(
      wo.mass > 0 ? Math.log10(wo.mass) : MIN_MASS_EXPONENT
    );
    this.menuSpeed.set(Math.round(wo.vel.length()));
    this.objectMenu?.openMenu();
  }

  /** Forgets the menu target once the menu is gone. */
  menuClosed(): void {
    this.menuTarget.set(null);
  }

  /** Puts a satellite in a circular orbit around the object of the menu. */
  addSatellite(): void {
    const parent: WorldObject | null = this.menuTarget();
    if (!parent) {
      return;
    }
    const satellite: Planet = new Planet(
      parent.pos,
      undefined,
      satelliteMass(parent)
    );
    const { pos, vel } = orbitAround(
      parent,
      // the sun holds everything else, so it decides how far a moon may sit
      defaultOrbitDistance(
        parent,
        parent === this.sun ? undefined : this.sun,
        satellite.radius
      ),
      Math.random() * 2 * Math.PI,
      this.settings().gravitationalConstant,
      // the satellite will pair up with every object that is already there
      this.worldService.getWorldObjects().length
    );
    satellite.pos = pos;
    satellite.vel = vel;
    this.worldService.addWorldObject(satellite);
    this.updateSignals();
  }

  /** Sets the mass of the menu target from the log scale of the slider. */
  setMassExponent(exponent: number): void {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return;
    }
    this.menuMassExponent.set(exponent);
    const mass: number = this.menuMass();
    if (target === this.sun) {
      // the sun takes its mass from the settings, so it has to change there
      this.settings.update((settings) => ({ ...settings, massOfSun: mass }));
    } else {
      target.mass = mass;
    }
    this.updateSignals();
  }

  /**
   * Sets how fast the menu target travels, keeping its direction. An object at
   * rest is sent into the direction it would need to orbit the sun.
   */
  setSpeed(speed: number): void {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return;
    }
    const direction: Vector2d =
      target.vel.length() > 0
        ? target.vel.norm()
        : this.orbitDirectionAroundSun(target);
    const clamped: number = clamp(speed, 0, MAX_SPEED);
    this.menuSpeed.set(clamped);
    target.vel = direction.mul(clamped);
    this.updateSignals();
  }

  /** Direction an object at its place would orbit the sun in. */
  private orbitDirectionAroundSun(wo: WorldObject): Vector2d {
    if (wo === this.sun || wo.pos.dist(this.sun.pos) === 0) {
      return vec2(1, 0);
    }
    return wo.pos.orthogonalTo(this.sun.pos);
  }

  stopSim(): void {
    this.running.set(false);
  }

  toggleSim(): void {
    this.running.update((running) => !running);
  }

  /** Advances the simulation once per animation frame while it is running. */
  private gameLoop(lastFrameTime?: number): void | null {
    requestAnimationFrame((time) => {
      if (!this.running()) {
        return;
      }
      const deltaTime: number = lastFrameTime
        ? (time - lastFrameTime) / 1000
        : 1 / 120;
      this.step(deltaTime);
      this.gameLoop(time);
    });
  }

  /** Advances the simulation by a single frame. */
  step(deltaTime: number): void {
    this.worldService.calcNextTick(deltaTime);
    const { showTrail, trailLength } = this.settings();
    this.worldService.recordTrails(showTrail ? trailLength : 0);
    this.updateSignals();
    const followed: WorldObject | null = this.followed();
    if (followed) {
      // the planets have moved, so the view has to move with the followed one
      this.centerOn(followed);
    }
  }

  /** Clears the world, resets the view and places sun and planets again. */
  reset(): void {
    this.stopSim();
    this.worldService.removeAll();
    this.resetView();
    this.initializeSunAndPlanets();
  }

  /**
   * Converts the position of a mouse event into world (svg viewBox) coordinates.
   * The viewBox keeps the aspect ratio of the css box, so the mapping is linear.
   */
  private toWorldCoordinates($event: MouseEvent): Vector2d {
    const rect: DOMRect | undefined = this.svgRect();
    if (!rect || !rect.width || !rect.height) {
      return this.viewCenter();
    }
    const size: Vector2d = this.viewSize();
    const origin: Vector2d = this.viewCenter().sub(size.div(2));
    return vec2(
      origin.x + (($event.clientX - rect.left) / rect.width) * size.x,
      origin.y + (($event.clientY - rect.top) / rect.height) * size.y
    );
  }

  /** The css box of the svg, or undefined before it is rendered. */
  private svgRect(): DOMRect | undefined {
    return this.svgWorld?.nativeElement?.getBoundingClientRect();
  }

  /** Creates a planet of random mass at the given world position. */
  private createRandomPlanetAt(pos: Vector2d): Planet {
    const planet: Planet = new Planet(pos, undefined, Math.random() * 400 + 30);
    return planet;
  }

  /** Takes the planet out of the world. */
  removePlanet(planet: Planet): void {
    if (this.followed() === planet) {
      this.stopFollowing();
    }
    this.worldService.removeWorldObject(planet);
    this.updateSignals();
  }
}

/** Restricts a value to the closed interval between `min` and `max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
