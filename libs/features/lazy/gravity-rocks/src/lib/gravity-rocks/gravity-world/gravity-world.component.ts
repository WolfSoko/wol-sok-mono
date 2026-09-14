import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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
  minOrbitDistance,
  orbitAround,
  orbitDistanceRange,
  placedPlanetMass,
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

/** Furthest zoom out, shown as 0.1% - enough to watch planets fly far away. */
export const MIN_ZOOM = 0.001;
export const MAX_ZOOM = 20;
const ZOOM_STEP = 1.3;
const WHEEL_ZOOM_STEP = 1.15;
const TRAIL_WIDTH_RATIO = 0.8;
/** How far the cursor may travel between press and release to still be a click. */
const CLICK_TOLERANCE_PX = 4;
/** How long a touch has to rest on an object to open its menu. */
const LONG_PRESS_MS = 450;
const RIGHT_BUTTON = 2;

/** Anything that carries a position in client (viewport) coordinates. */
interface ClientPoint {
  clientX: number;
  clientY: number;
}

/** Copy of a position, so a moving pointer does not change what was stored. */
function clientPoint({ clientX, clientY }: ClientPoint): ClientPoint {
  return { clientX, clientY };
}

/** How far two pointers are apart, in client pixels. */
function distanceBetween(a: ClientPoint, b: ClientPoint): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** The point exactly between two pointers, which a pinch is anchored on. */
function midpointOf(a: ClientPoint, b: ClientPoint): ClientPoint {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
}

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

  /** Zoom as a percentage label, with one decimal while zoomed far out. */
  readonly zoomLabel: Signal<string> = computed(() => {
    const percent: number = this.zoom() * 100;
    return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
  });
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

  private pointerDown$: Subject<PointerEvent> = new Subject();
  private pointerMove$: Subject<PointerEvent> = new Subject();
  /** Emits whenever the running gesture ends, however it ends. */
  private gestureEnd$: Subject<void> = new Subject();

  private panStart: { x: number; y: number; center: Vector2d } | null = null;

  /** Pointers currently pressed on the world, by pointer id. */
  private readonly activePointers = new Map<number, ClientPoint>();

  /** The pointer driving the current drag, and the planet it created. */
  private dragPointerId: number | null = null;
  private createdByDrag: Planet | null = null;

  /** What the drag holds, where it started, and where it has been taken. */
  private dragObject: WorldObject | null = null;
  private dragOrigin: ClientPoint | null = null;
  private dragEnd: Vector2d | null = null;

  /** What the view looked like when the two finger gesture started. */
  private pinchStart: {
    distance: number;
    focus: Vector2d;
    zoom: number;
  } | null = null;

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
  /**
   * Mass of the menu target. Kept next to the exponent rather than derived
   * from it: a mass typed into the settings can sit outside the slider range,
   * and then the label still has to tell the truth.
   */
  readonly menuMass: WritableSignal<number> = signal(0);
  readonly menuSpeed: WritableSignal<number> = signal(0);
  /** How far from the menu target its next satellite is placed. */
  readonly menuOrbit: WritableSignal<number> = signal(0);
  /** Whether the simulation was running when the menu took over. */
  private pausedForMenu = false;
  /**
   * How far a satellite of the menu target may sit from it. Mass decides both
   * discs and the reach of the target's gravity, speed decides how tightly a
   * satellite may circle it, so the range follows both sliders - and the sun
   * carries its mass in the settings, which is read for the same reason.
   */
  readonly orbitRange: Signal<{ min: number; max: number }> = computed(() => {
    const target: WorldObject | null = this.menuTarget();
    const mass: number = this.menuMass();
    const { gravitationalConstant } = this.settings();
    // every object in the world pairs up with the satellite: the planets and
    // the sun, which is what `addSatellite` counts
    const pairs: number = this.planets().length + 1;
    if (!target || mass <= 0) {
      return { min: 0, max: 0 };
    }
    return orbitDistanceRange(
      target,
      // the sun holds everything else, so it decides how far a moon may sit
      target === this.sun ? undefined : this.sun,
      this.satelliteFor(target).radius,
      // a satellite beyond the world would leave nothing to look at
      this.canvasSize().x / 2,
      minOrbitDistance(
        target,
        gravitationalConstant,
        pairs,
        target.isStatic ? 0 : this.menuSpeed()
      )
    );
  });

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

  drag$: Observable<{ end: Vector2d }> = this.pointerDown$.asObservable().pipe(
    take(1),
    switchMap(() =>
      this.pointerMove$.asObservable().pipe(
        map((pm: PointerEvent) => ({
          end: this.toWorldCoordinates(pm),
        })),
        takeUntil(this.gestureEnd$.asObservable())
      )
    )
  );

  trackByPlanet: TrackByFunction<Planet> = (index, planet) => planet.pos;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelLongPress());
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
   * Starts panning, or grabs the world object under the pointer with a spring -
   * creating a new planet first when the pointer is on empty space. Releasing
   * without dragging centers the object that was pressed on. A second finger
   * turns the gesture into pinch zoom and pan instead.
   */
  pointerDown($event: PointerEvent): void {
    if ($event.button === RIGHT_BUTTON) {
      // the object menu owns the right button; its overlay backdrop swallows
      // the pointerup, so a gesture started here would never be unwound
      return;
    }
    if (this.activePointers.size >= 2) {
      // two fingers already own the gesture, a third would only confuse it
      return;
    }
    this.activePointers.set($event.pointerId, clientPoint($event));
    // keep receiving moves once the gesture wanders off the svg - the second
    // finger needs that just as much as the first
    this.svgWorld?.nativeElement?.setPointerCapture?.($event.pointerId);
    if (this.activePointers.size === 2) {
      // the first finger was only ever the start of a two finger gesture
      this.cancelDrag();
      this.startPinch();
      return;
    }
    if (this.isPanGesture($event)) {
      this.startPan($event);
      return;
    }
    let wo = this.findWorldObject($event.target as SVGElement);
    if (wo) {
      this.pressed = { wo, x: $event.clientX, y: $event.clientY };
      if ($event.pointerType !== 'mouse') {
        // touch has no right button, so resting on an object opens the menu
        this.startLongPress(wo, $event);
      }
    } else {
      // a click on empty space places a planet, it does not move the view
      const created: Planet = this.createRandomPlanetAt(
        this.toWorldCoordinates($event)
      );
      this.worldService.addWorldObject(created);
      this.createdByDrag = created;
      wo = created;
    }
    this.dragPointerId = $event.pointerId;
    this.dragObject = wo;
    this.dragOrigin = clientPoint($event);
    this.dragEnd = null;
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
    this.pointerDown$.next($event);
  }

  private removeForce(springForce: SpringForce): void {
    this.worldService.removeForceObject(springForce);
    this.updateSignals();
  }

  /** Ends the current pan or drag gesture, following a tapped object. */
  pointerUp($event: PointerEvent): void {
    const pressed = this.endGesture($event);
    if (pressed && this.isWithinClickTolerance(pressed, $event)) {
      this.toggleFollow(pressed.wo);
    }
  }

  /** Ends the gesture without following, the system took the pointer away. */
  pointerCancel($event: PointerEvent): void {
    this.endGesture($event);
  }

  /**
   * Unwinds everything this pointer started and reports the object it was
   * pressed on, as long as the gesture stayed within the click tolerance.
   */
  private endGesture(
    $event: PointerEvent
  ): { wo: WorldObject; x: number; y: number } | null {
    this.activePointers.delete($event.pointerId);
    const svg: SVGSVGElement | undefined = this.svgWorld?.nativeElement;
    if (svg?.hasPointerCapture?.($event.pointerId)) {
      svg.releasePointerCapture($event.pointerId);
    }
    this.cancelLongPress();
    if (this.pinchStart) {
      // the finger left over must not carry on as a drag of its own
      if (this.activePointers.size < 2) {
        this.pinchStart = null;
      }
      return null;
    }
    const pressed = this.pressed;
    this.panStart = null;
    this.pressed = null;
    this.dragPointerId = null;
    this.createdByDrag = null;
    this.gestureEnd$.next();
    this.throwDragged();
    return pressed;
  }

  /**
   * Hands the dragged object the speed of the gesture that let go of it.
   * A running simulation gets that from the spring, whose acceleration works
   * out to the distance it is stretched by - mass cancels out of `-mass *
   * distance`. A paused world never ticks, so the same stretch is turned into
   * a velocity here instead, once, when the gesture ends.
   */
  private throwDragged(): void {
    const wo: WorldObject | null = this.dragObject;
    const end: Vector2d | null = this.dragEnd;
    this.dragObject = null;
    this.dragOrigin = null;
    this.dragEnd = null;
    if (!wo || !end || wo.isStatic || this.running()) {
      return;
    }
    const thrown: Vector2d = end.sub(wo.pos);
    const speed: number = Math.min(thrown.length(), MAX_VELOCITY);
    if (speed <= 0) {
      return;
    }
    wo.vel = thrown.norm().mul(speed);
    this.updateSignals();
  }

  /** Drops the running drag, taking back the planet it has just created. */
  private cancelDrag(): void {
    this.cancelLongPress();
    const created = this.createdByDrag;
    this.panStart = null;
    this.pressed = null;
    this.dragPointerId = null;
    this.createdByDrag = null;
    // an abandoned gesture is not a throw
    this.dragObject = null;
    this.dragOrigin = null;
    this.dragEnd = null;
    this.gestureEnd$.next();
    if (created) {
      this.removePlanet(created);
    }
  }

  /** Zooms and pans with two fingers, moves the view while panning, and
   * otherwise feeds the drag gesture. */
  pointerMove($event: PointerEvent): void {
    const active = this.activePointers.get($event.pointerId);
    if (active) {
      this.activePointers.set($event.pointerId, clientPoint($event));
    }
    if (this.pinchStart) {
      this.pinch();
      return;
    }
    if (this.panStart) {
      this.pan($event);
      return;
    }
    if (this.pressed && !this.isWithinClickTolerance(this.pressed, $event)) {
      // the gesture has become a drag, releasing it must not center anything,
      // not even when the pointer comes back to where it started
      this.pressed = null;
      this.cancelLongPress();
    }
    if (this.dragPointerId === $event.pointerId) {
      const origin: ClientPoint | null = this.dragOrigin;
      if (
        origin &&
        !this.isWithinClickTolerance(
          { x: origin.clientX, y: origin.clientY },
          $event
        )
      ) {
        // a gesture this long is a drag, and a drag can throw
        this.dragEnd = this.toWorldCoordinates($event);
      }
      this.pointerMove$.next($event);
    }
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
  private isPanGesture($event: PointerEvent): boolean {
    return (
      $event.button === 1 || $event.shiftKey || $event.ctrlKey || $event.metaKey
    );
  }

  /** Remembers where the pan gesture started, in client and world coordinates. */
  private startPan($event: PointerEvent): void {
    $event.preventDefault();
    // panning is manual control, it wins over following
    this.stopFollowing();
    this.panStart = {
      x: $event.clientX,
      y: $event.clientY,
      center: this.viewCenter(),
    };
  }

  /** Moves the view center by the distance the pointer travelled since `startPan`. */
  private pan($event: PointerEvent): void {
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

  /** Remembers the spread of the two fingers and the world point between them. */
  private startPinch(): void {
    const [first, second] = [...this.activePointers.values()];
    if (!first || !second) {
      return;
    }
    // pinching is manual control, it wins over following
    this.stopFollowing();
    this.pinchStart = {
      // a pinch that starts with the fingers on one spot must not divide by 0
      distance: Math.max(distanceBetween(first, second), 1),
      focus: this.toWorldCoordinates(midpointOf(first, second)),
      zoom: this.zoom(),
    };
  }

  /**
   * Zooms by how far the fingers have spread and pans by where they moved,
   * so the world point that started between them stays between them.
   */
  private pinch(): void {
    const pinchStart = this.pinchStart;
    const [first, second] = [...this.activePointers.values()];
    if (!pinchStart || !first || !second) {
      return;
    }
    const spread: number = distanceBetween(first, second) / pinchStart.distance;
    this.zoom.set(clamp(pinchStart.zoom * spread, MIN_ZOOM, MAX_ZOOM));
    this.viewCenter.set(
      this.clampToViewBounds(
        this.centerKeeping(pinchStart.focus, midpointOf(first, second))
      )
    );
  }

  /** View center that puts `focus` (world coordinates) under `client`. */
  private centerKeeping(focus: Vector2d, client: ClientPoint): Vector2d {
    const rect: DOMRect | undefined = this.svgRect();
    if (!rect?.width || !rect.height) {
      return this.viewCenter();
    }
    const size: Vector2d = this.viewSize();
    return vec2(
      focus.x - ((client.clientX - rect.left) / rect.width - 0.5) * size.x,
      focus.y - ((client.clientY - rect.top) / rect.height - 0.5) * size.y
    );
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

  /** A finger resting on an object opens its menu, like a right click. */
  private startLongPress(wo: WorldObject, $event: PointerEvent): void {
    const { clientX, clientY } = $event;
    // a second finger must not orphan the timer of the first
    this.cancelLongPress();
    this.longPressTimer = setTimeout(() => {
      // the finger is still down, so let go of the object before the menu
      // takes over - otherwise it would be flung when the finger lifts
      this.cancelDrag();
      this.openMenuFor(wo, clientX, clientY);
    }, LONG_PRESS_MS);
  }

  /** A moving or ending pointer is a drag or a tap, not a long press. */
  cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private openMenuFor(wo: WorldObject, x: number, y: number): void {
    this.cancelLongPress();
    // a menu on a moving object would run away from what it acts on
    this.pausedForMenu = this.running();
    this.stopSim();
    this.menuTarget.set(wo);
    this.menuPosition.set({ x, y });
    this.menuMass.set(wo.mass);
    this.menuMassExponent.set(
      clamp(
        wo.mass > 0 ? Math.log10(wo.mass) : MIN_MASS_EXPONENT,
        MIN_MASS_EXPONENT,
        MAX_MASS_EXPONENT
      )
    );
    this.menuSpeed.set(Math.round(wo.vel.length()));
    this.menuOrbit.set(
      clamp(
        defaultOrbitDistance(
          wo,
          wo === this.sun ? undefined : this.sun,
          this.satelliteFor(wo).radius
        ),
        this.orbitRange().min,
        this.orbitRange().max
      )
    );
    this.objectMenu?.openMenu();
  }

  /** Forgets the target and picks the simulation back up where it left off. */
  menuClosed(): void {
    this.menuTarget.set(null);
    if (this.pausedForMenu) {
      this.pausedForMenu = false;
      this.running.set(true);
    }
  }

  /** Puts a satellite in a circular orbit around the object of the menu. */
  addSatellite(): void {
    const parent: WorldObject | null = this.menuTarget();
    if (!parent) {
      return;
    }
    const satellite: Planet = this.satelliteFor(parent);
    const { pos, vel } = orbitAround(
      parent,
      this.menuOrbit(),
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

  /** Sets how far from the menu target its next satellite will be placed. */
  setOrbitDistance(distance: number): void {
    const { min, max } = this.orbitRange();
    this.menuOrbit.set(clamp(distance, min, max));
  }

  /** The satellite the menu target would be given: its moon, or its planet. */
  private satelliteFor(parent: WorldObject): Planet {
    return new Planet(parent.pos, undefined, satelliteMass(parent));
  }

  /** Sets the mass of the menu target from the log scale of the slider. */
  setMassExponent(exponent: number): void {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return;
    }
    this.menuMassExponent.set(
      clamp(exponent, MIN_MASS_EXPONENT, MAX_MASS_EXPONENT)
    );
    const mass: number = Math.round(10 ** this.menuMassExponent());
    this.menuMass.set(mass);
    if (target === this.sun) {
      // the sun takes its mass from the settings, so it has to change there -
      // but the effect handing it over only runs once this turn is done, and
      // the orbit range below reads the sun's radius right away
      this.sun.mass = mass;
      this.settings.update((settings) => ({ ...settings, massOfSun: mass }));
    } else {
      target.mass = mass;
    }
    // both discs and the reach of the target's gravity have just changed
    this.setOrbitDistance(this.menuOrbit());
    this.updateSignals();
  }

  /**
   * Sets how fast the menu target travels, keeping its direction. An object at
   * rest is sent into the direction it would need to orbit the sun.
   */
  setSpeed(speed: number): void {
    const target: WorldObject | null = this.menuTarget();
    // a static object never moves, a speed on it would only be inherited by
    // the satellites added to it
    if (!target || target.isStatic) {
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
   * Converts a client position into world (svg viewBox) coordinates. The
   * viewBox keeps the aspect ratio of the css box, so the mapping is linear.
   */
  private toWorldCoordinates($event: ClientPoint): Vector2d {
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
    // a planet keeps its place next to the sun however heavy the sun is set
    return new Planet(
      pos,
      undefined,
      placedPlanetMass(this.settings().massOfSun)
    );
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
