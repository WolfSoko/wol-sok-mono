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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
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
  INITIAL_SIMULATION_SPEED,
  MAX_SIMULATION_SPEED,
  MIN_SIMULATION_SPEED,
} from './domain/gravity-world-config';
import { GravityWorldService } from './domain/gravity-world.service';
import {
  Force,
  SPRING_SPEED_PER_AU,
  SpringForce,
} from './domain/world-objects/force';
import { Planet } from './domain/world-objects/planet';
import {
  defaultOrbitDistance,
  keepsSatelliteAt,
  minOrbitDistance,
  orbitAround,
  orbitDistanceRange,
  placedPlanetMass,
  satelliteMass,
} from './domain/world-objects/orbit';
import {
  circularOrbitSpeed,
  EARTH_MASS,
  PLANET_NAMES,
  PLANETS,
} from './domain/solar-system';
import { Sun } from './domain/world-objects/sun';
import { SvgPath, TrailSegment } from './domain/world-objects/svg-path';
import {
  svgPathForVelocity,
  toSvgPath,
  trailToSvgSegments,
} from './domain/world-objects/toSvgPath';
import { MAX_VELOCITY, WorldObject } from './domain/world-objects/world-object';

/**
 * Width of the world in AU. Six puts the orbit of mars, the outermost planet
 * the world starts with, inside the frame with room to spare.
 */
const SVG_VIEW_PORT_SIZE = 6;

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
/**
 * How long the browser may take to turn a lifted finger into a click. It fires
 * one a moment after the touch ends, at the point the finger was - which by
 * then is the backdrop of the menu the long press has just opened.
 */
const SYNTHETIC_CLICK_MS = 700;
/**
 * World time one second of watching is worth, in years. A tenth takes the
 * earth ten seconds to go round the sun at the usual speed - slow enough to
 * follow, fast enough not to wait for mars.
 */
export const YEARS_PER_SECOND = 0.1;
/**
 * Longest slice of world time the integrator can follow in one go, in years.
 * A third of a day, so mercury's 88-day year is two hundred and forty of them:
 * even the fastest planet is carried through its orbit in hundreds of steps
 * rather than tens, and its ellipse stays put instead of creeping.
 */
export const MAX_TICK_YEARS = 0.001;
/**
 * Slices one frame may be cut into, so speed cannot stall the browser. Enough
 * that the fastest simulation still runs at its full speed while frames take
 * up to `MAX_TICKS_PER_FRAME * MAX_TICK_YEARS / (YEARS_PER_SECOND *
 * MAX_SIMULATION_SPEED)` - a twentieth of a second, which is as slow as a
 * screen gets before nothing looks right anyway.
 */
export const MAX_TICKS_PER_FRAME = 60;
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

/**
 * The mass slider runs on the log scale of earth masses: from a thousandth
 * of one, which is half a pluto, to a million, which is three suns.
 */
export const MIN_MASS_EXPONENT = -3;
export const MAX_MASS_EXPONENT = 6;
/**
 * Fastest the speed slider goes, in AU/year. Not the ceiling the integrator
 * keeps - that is `MAX_VELOCITY`, eight times higher, and a drag can still
 * reach it - but the fastest a body here is worth setting by hand: not quite
 * twice what it takes to leave the sun from the orbit of mercury, where the
 * earth travels at 6.3 and mercury at 10.
 */
export const MAX_SPEED = 25;

/** What a press on the world does - picked from the toolbelt. */
export type Tool = 'grab' | 'select' | 'add' | 'orbit' | 'delete';

/** What the add tool puts down on empty space. */
export type ObjectKind = 'asteroid' | 'planet' | 'giant' | 'star';

export const TOOLS: readonly {
  id: Tool;
  icon: string;
  label: string;
  hint: string;
}[] = [
  {
    id: 'grab',
    icon: 'pan_tool',
    label: 'Grab',
    hint: 'Grab: drag a body to fling it, tap it to follow it',
  },
  {
    id: 'select',
    icon: 'ads_click',
    label: 'Select',
    hint: 'Select: tap a body to open its settings',
  },
  {
    id: 'add',
    icon: 'add_circle',
    label: 'Add',
    hint: 'Add: tap empty space to put a body there, drag to fling it',
  },
  {
    id: 'orbit',
    icon: 'track_changes',
    label: 'Put in orbit',
    hint: 'Put in orbit: tap a body to give it a satellite',
  },
  {
    id: 'delete',
    icon: 'delete',
    label: 'Delete',
    hint: 'Delete: tap a body to take it out of the world',
  },
];

/**
 * A thousandth of an earth, the lightest the mass slider goes; a jupiter, at
 * 318 earths; and a star weighs whatever the sun is set to.
 */
const ASTEROID_MASS = EARTH_MASS / 1000;
const GIANT_MASS = EARTH_MASS * 318;

export const OBJECT_KINDS: readonly {
  id: ObjectKind;
  icon: string;
  label: string;
}[] = [
  { id: 'asteroid', icon: 'grain', label: 'Asteroid' },
  { id: 'planet', icon: 'public', label: 'Planet' },
  { id: 'giant', icon: 'lens', label: 'Gas giant' },
  { id: 'star', icon: 'star', label: 'Star' },
];

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
    MatSliderModule,
    MatButtonToggleModule,
    MatDividerModule,
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

  settings: WritableSignal<GravityWorldConfig>;

  readonly tools = TOOLS;
  readonly objectKinds = OBJECT_KINDS;
  /** What a press on the world does. */
  readonly tool: WritableSignal<Tool> = signal('grab');
  /** What the add tool puts down. */
  readonly addKind: WritableSignal<ObjectKind> = signal('planet');

  public running = signal(false);
  sun!: Sun;
  planets: WritableSignal<Planet[]> = signal([]);

  forces: WritableSignal<Force[]> = signal([]);
  forcesSvgPaths: Signal<SvgPath[]> = computed(() =>
    this.forces()
      .map((f) => toSvgPath(f))
      .filter(notNil)
  );

  /**
   * An arrow per body showing where its velocity takes it next, or nothing
   * at all while the setting is off - which it is until someone asks for it.
   */
  velocitySvgPath: Signal<SvgPath[]> = computed(() =>
    this.settings().showVelocity
      ? this.planets().map((planet) =>
          svgPathForVelocity(planet.id, planet.pos, planet.vel)
        )
      : []
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
    return (
      [origin.x, origin.y, size.x, size.y]
        // AU, so a hundredth would be a million kilometres of jitter
        .map((value) => Math.round(value * 1e6) / 1e6)
        .join(' ')
    );
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

  /** World object whose settings panel is open, if any. */
  readonly menuTarget: WritableSignal<WorldObject | null> = signal(null);

  /** What the panel calls its target. */
  readonly menuTitle: Signal<string> = computed(() => {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return '';
    }
    if (!(target instanceof Planet)) {
      return 'Sun';
    }
    return this.planetName(target, this.planets().indexOf(target));
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
    // in earth masses, read only to follow the slider - the sizes below come
    // from the object, which the slider has already updated
    const mass: number = this.menuMass();
    const { gravitationalConstant } = this.settings();
    if (!target || mass <= 0) {
      return { min: 0, max: 0 };
    }
    return orbitDistanceRange(
      target,
      // what holds the target itself decides how far its own satellite may
      // sit - the sun for a planet, but the planet for a moon, not the sun
      this.primaryOf(target),
      this.satelliteFor(target).radius,
      // a satellite beyond the world would leave nothing to look at
      this.canvasSize().x / 2,
      minOrbitDistance(
        target,
        gravitationalConstant,
        target.isStatic ? 0 : this.menuSpeed()
      )
    );
  });

  /**
   * How far the menu target itself currently sits from its own parent - the
   * sun for a planet, the planet for a moon. The sliders own this state for
   * the same reason `menuMass` does: the world objects are mutable, and a
   * signal reading their fields would not notice a change.
   */
  readonly menuDistance: WritableSignal<number> = signal(0);

  /**
   * How far the menu target may be moved from its own parent: from its disc
   * just clearing its parent's, to where its parent's own primary would pull
   * it away instead - the same rule `orbitRange` places a new satellite by,
   * applied to the target itself.
   */
  readonly menuDistanceRange: Signal<{ min: number; max: number }> = computed(
    () => {
      const target: WorldObject | null = this.menuTarget();
      // read only to follow the mass slider - the sizes below come from the
      // objects themselves, which the slider has already updated
      const mass: number = this.menuMass();
      const { gravitationalConstant } = this.settings();
      const parent: WorldObject | undefined = target
        ? this.primaryOf(target)
        : undefined;
      if (!target || !parent || mass <= 0) {
        // the sun has no parent to move against
        return { min: 0, max: 0 };
      }
      return orbitDistanceRange(
        parent,
        this.primaryOf(parent),
        target.radius,
        this.canvasSize().x / 2,
        minOrbitDistance(
          parent,
          gravitationalConstant,
          parent.isStatic ? 0 : parent.vel.length()
        )
      );
    }
  );

  /** Step of the distance slider, on the same hundredth-of-the-range rule as `orbitStep`. */
  readonly menuDistanceStep: Signal<number> = computed(() => {
    const { min, max } = this.menuDistanceRange();
    return Math.max((max - min) / 100, 1e-4);
  });

  /** What the menu target orbits: the sun, or a planet. Empty for the sun itself. */
  readonly parentName: Signal<string> = computed(() => {
    const target: WorldObject | null = this.menuTarget();
    if (!target || target === this.sun) {
      return '';
    }
    return this.primaryOf(target) === this.sun ? 'sun' : 'planet';
  });

  /**
   * Step of the orbit slider: a hundredth of what it can cover. A fixed step
   * cannot do, the range is a few hundredths of an AU around a planet and a
   * few whole ones around the sun.
   */
  readonly orbitStep: Signal<number> = computed(() => {
    const { min, max } = this.orbitRange();
    // a range with nothing to choose still needs a step the slider accepts
    return Math.max((max - min) / 100, 1e-4);
  });

  /** What a satellite of the menu target would be: a planet, or a moon. */
  readonly satelliteName: Signal<string> = computed(() =>
    this.menuTarget() === this.sun ? 'planet' : 'moon'
  );

  /**
   * Whether the target keeps a satellite on the orbit the slider is set to,
   * or its own primary takes it away in time - which is every orbit a light
   * planet can offer, and what its mass slider is there to fix.
   */
  readonly orbitHeld: Signal<boolean> = computed(() => {
    const target: WorldObject | null = this.menuTarget();
    // read only to follow the mass slider, like `orbitRange` does - and the
    // distance to the primary, which `step` keeps up while the world runs
    this.menuMass();
    this.menuDistance();
    return (
      !target ||
      keepsSatelliteAt(target, this.primaryOf(target), this.menuOrbit())
    );
  });

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

  /**
   * Puts the sun in the middle and the inner planets around it, each on its
   * real orbit with the speed that orbit takes, spread out so they do not
   * start in a row. Mercury through mars: the ones that fit in the frame.
   */
  private initializeSunAndPlanets(): void {
    this.sun = new Sun(
      this.calcCenteredVec(),
      undefined,
      this.settings().massOfSun
    );
    this.worldService.addWorldObject(this.sun);

    const centralMass: number = this.sun.mass;
    const { gravitationalConstant } = this.settings();
    PLANETS.forEach((body, index) => {
      // an eighth of a turn between neighbours, so no two of them line up
      const angle: number = (index * Math.PI) / 4;
      const outwards: Vector2d = vec2(Math.cos(angle), Math.sin(angle));
      const speed: number = circularOrbitSpeed(
        centralMass,
        body.orbit,
        gravitationalConstant
      );
      const planet: Planet = new Planet(
        this.calcCenteredVec(outwards.mul(body.orbit)),
        // a circular orbit runs perpendicular to the line to the sun
        vec2(outwards.y, -outwards.x).mul(speed),
        body.mass,
        body.name,
        body.radius
      );
      planet.parent = this.sun;
      this.worldService.addWorldObject(planet);
    });
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
   * Starts what the tool in hand does: a pan on empty space, or on a body a
   * gesture that ends in `tap` when the pointer is let go where it was
   * pressed. The grab tool also hooks a spring onto the body to drag and
   * fling it, and the add tool first puts a new body under the pointer to do
   * the same with. A second finger turns any of it into pinch zoom and pan.
   */
  pointerDown($event: PointerEvent): void {
    if ($event.button === RIGHT_BUTTON) {
      // the right button opens the settings panel, see `contextMenu`
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
    const tool: Tool = this.tool();
    let wo = this.findWorldObject($event.target as SVGElement);
    if (wo) {
      this.pressed = { wo, x: $event.clientX, y: $event.clientY };
      if ($event.pointerType !== 'mouse') {
        // touch has no right button, so resting on an object opens the panel
        this.startLongPress(wo);
      }
      if (tool !== 'grab' && tool !== 'add') {
        // the other tools act on the tap, there is nothing to drag
        return;
      }
    } else if (tool === 'add') {
      // a click on empty space places a body, it does not move the view
      const created: Planet = this.createObjectAt(
        this.toWorldCoordinates($event),
        this.addKind()
      );
      this.worldService.addWorldObject(created);
      this.createdByDrag = created;
      wo = created;
    } else {
      this.startPan($event);
      return;
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

  /** Ends the current pan or drag gesture, and taps the object it was on. */
  pointerUp($event: PointerEvent): void {
    const pressed = this.endGesture($event);
    if (pressed && this.isWithinClickTolerance(pressed, $event)) {
      this.tap(pressed.wo);
    }
  }

  /** What a tap on a body does, by the tool in hand. */
  private tap(wo: WorldObject): void {
    switch (this.tool()) {
      case 'select':
        this.openMenuFor(wo);
        break;
      case 'orbit':
        this.addSatelliteTo(wo);
        break;
      case 'delete':
        if (wo instanceof Planet) {
          this.removePlanet(wo);
        }
        break;
      default:
        this.toggleFollow(wo);
    }
  }

  /** Ends the gesture without following, the system took the pointer away. */
  pointerCancel($event: PointerEvent): void {
    // a placement the system cut short was never finished
    const created: Planet | null = this.createdByDrag;
    this.endGesture($event);
    if (created) {
      this.removePlanet(created);
    }
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
   * out to the stretch times `SPRING_SPEED_PER_AU` - mass cancels out of
   * `-mass * stiffness * distance`. A paused world never ticks, so the same
   * stretch is turned into a velocity here instead, once, on release.
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
    const stretch: Vector2d = end.sub(wo.pos);
    const speed: number = Math.min(
      stretch.length() * SPRING_SPEED_PER_AU,
      MAX_VELOCITY
    );
    if (speed <= 0) {
      return;
    }
    wo.vel = stretch.norm().mul(speed);
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

  /** Opens the settings of the object under the cursor on a right click. */
  contextMenu($event: MouseEvent): void {
    const wo: WorldObject | undefined = this.findWorldObject(
      $event.target as SVGElement
    );
    if (!wo) {
      return;
    }
    $event.preventDefault();
    this.openMenuFor(wo);
  }

  /** A finger resting on an object opens its settings, like a right click. */
  private startLongPress(wo: WorldObject): void {
    // a second finger must not orphan the timer of the first
    this.cancelLongPress();
    this.longPressTimer = setTimeout(() => {
      // the finger is still down, so let go of the object before the panel
      // takes over - otherwise it would be flung when the finger lifts
      this.cancelDrag();
      this.openMenuFor(wo);
      // and it is still down now, so the click it turns into is still coming
      this.swallowNextClick();
    }, LONG_PRESS_MS);
  }

  /**
   * Eats the one click a lifted finger is turned into. It lands where the
   * finger was, which by then may be under the panel the long press has just
   * opened - on a slider, or on the button that closes it again. Nothing
   * else is swallowed: the listener gives up on the first click, or after
   * the browser can no longer be sending that one.
   */
  private swallowNextClick(): void {
    const swallow = (event: MouseEvent): void => {
      event.stopPropagation();
      event.preventDefault();
      stop();
    };
    // both close over `timer`, which is set by the time either of them runs
    const stop = (): void => {
      document.removeEventListener('click', swallow, true);
      clearTimeout(timer);
    };
    const timer: ReturnType<typeof setTimeout> = setTimeout(
      stop,
      SYNTHETIC_CLICK_MS
    );
    document.addEventListener('click', swallow, true);
  }

  /** A moving or ending pointer is a drag or a tap, not a long press. */
  cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /** Opens the settings panel for the given object, pausing the world. */
  private openMenuFor(wo: WorldObject): void {
    this.cancelLongPress();
    // sliders on a moving object would set what has already moved on - and a
    // world the panel already paused for one body stays owed its restart
    // when the panel moves on to another
    this.pausedForMenu = this.pausedForMenu || this.running();
    this.stopSim();
    this.menuTarget.set(wo);
    const earthMasses: number = wo.mass / EARTH_MASS;
    this.menuMass.set(earthMasses);
    this.menuMassExponent.set(
      clamp(
        earthMasses > 0 ? Math.log10(earthMasses) : MIN_MASS_EXPONENT,
        MIN_MASS_EXPONENT,
        MAX_MASS_EXPONENT
      )
    );
    this.menuSpeed.set(wo.vel.length());
    const primary: WorldObject | undefined = this.primaryOf(wo);
    this.menuOrbit.set(
      clamp(
        defaultOrbitDistance(wo, primary, this.satelliteFor(wo).radius),
        this.orbitRange().min,
        this.orbitRange().max
      )
    );
    this.menuDistance.set(
      primary
        ? clamp(
            wo.pos.dist(primary.pos),
            this.menuDistanceRange().min,
            this.menuDistanceRange().max
          )
        : 0
    );
  }

  /**
   * What holds `target` on its own orbit: the sun for a planet, the planet
   * for a moon, `undefined` for the sun itself, which has no parent.
   */
  private primaryOf(target: WorldObject): WorldObject | undefined {
    if (target === this.sun) {
      return undefined;
    }
    return target instanceof Planet ? (target.parent ?? this.sun) : this.sun;
  }

  /** Forgets the target and picks the simulation back up where it left off. */
  menuClosed(): void {
    this.menuTarget.set(null);
    if (this.pausedForMenu) {
      this.pausedForMenu = false;
      this.running.set(true);
    }
  }

  /** Puts a satellite in a circular orbit around the object of the panel. */
  addSatellite(): void {
    const parent: WorldObject | null = this.menuTarget();
    if (parent) {
      this.addSatelliteTo(parent, this.menuOrbit());
    }
  }

  /**
   * Puts a satellite in a circular orbit around `parent`, at `distance` or
   * where one is placed by default.
   */
  private addSatelliteTo(
    parent: WorldObject,
    distance: number = defaultOrbitDistance(
      parent,
      this.primaryOf(parent),
      this.satelliteFor(parent).radius
    )
  ): void {
    const satellite: Planet = this.satelliteFor(parent);
    const { pos, vel } = orbitAround(
      parent,
      distance,
      Math.random() * 2 * Math.PI,
      this.settings().gravitationalConstant
    );
    satellite.pos = pos;
    satellite.vel = vel;
    this.worldService.addWorldObject(satellite);
    this.updateSignals();
  }

  /** Takes the object of the panel out of the world, and the panel with it. */
  removeTarget(): void {
    const target: WorldObject | null = this.menuTarget();
    if (target instanceof Planet) {
      this.removePlanet(target);
    }
  }

  /** Sets how far from the menu target its next satellite will be placed. */
  setOrbitDistance(distance: number): void {
    const { min, max } = this.orbitRange();
    this.menuOrbit.set(clamp(distance, min, max));
  }

  /**
   * Moves the menu target itself to `distance` from its own parent, onto a
   * circular orbit at the angle it already sits at - the sun has no parent to
   * move against, so this does nothing for it.
   */
  setDistance(distance: number): void {
    const target: WorldObject | null = this.menuTarget();
    const parent: WorldObject | undefined = target
      ? this.primaryOf(target)
      : undefined;
    if (!target || !parent) {
      return;
    }
    const { min, max } = this.menuDistanceRange();
    const clamped: number = clamp(distance, min, max);
    const angle: number = Math.atan2(
      target.pos.y - parent.pos.y,
      target.pos.x - parent.pos.x
    );
    const { pos, vel } = orbitAround(
      parent,
      clamped,
      angle,
      this.settings().gravitationalConstant
    );
    target.pos = pos;
    target.vel = vel;
    this.menuDistance.set(clamped);
    this.updateSignals();
  }

  /** The satellite the menu target would be given: its moon, or its planet. */
  private satelliteFor(parent: WorldObject): Planet {
    const satellite: Planet = new Planet(
      parent.pos,
      undefined,
      satelliteMass(parent)
    );
    satellite.parent = parent;
    return satellite;
  }

  /**
   * Sets the mass of the menu target from the log scale of the slider, which
   * counts in earth masses - a scale a person can hold on to, where the solar
   * masses the world runs on would be millionths.
   */
  setMassExponent(exponent: number): void {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return;
    }
    this.menuMassExponent.set(
      clamp(exponent, MIN_MASS_EXPONENT, MAX_MASS_EXPONENT)
    );
    const earthMasses: number = 10 ** this.menuMassExponent();
    this.menuMass.set(earthMasses);
    const mass: number = earthMasses * EARTH_MASS;
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
    // the target's own disc has changed too, which can grow it into its
    // parent's - move it back onto a valid orbit if its real place no longer
    // is one, otherwise leave it be: a mass tweak is not a request to move it
    const parent: WorldObject | undefined = this.primaryOf(target);
    if (parent) {
      const current: number = target.pos.dist(parent.pos);
      const { min, max } = this.menuDistanceRange();
      const clamped: number = clamp(current, min, max);
      if (clamped === current) {
        this.menuDistance.set(current);
      } else {
        this.setDistance(clamped);
      }
    }
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
    // set by hand now, so closing the panel must not set it back
    this.pausedForMenu = false;
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

  /**
   * Advances the simulation by a single frame of the given length. The
   * simulation speed decides how much world time that frame is worth, and
   * that time is cut into slices the integrator can still follow: at ten
   * times speed one step would be ten frames wide and the orbits would fly
   * apart. At the usual speed a frame stays a single slice.
   */
  step(deltaTime: number): void {
    const { showTrail, trailLength, simulationSpeed } = this.settings();
    // the config is an injection token, so a speed can be missing entirely
    const speed: number = clamp(
      simulationSpeed > 0 ? simulationSpeed : INITIAL_SIMULATION_SPEED,
      MIN_SIMULATION_SPEED,
      MAX_SIMULATION_SPEED
    );
    // a frame the tab slept through would otherwise arrive as one enormous
    // slice per tick: that time is dropped instead, which costs the world a
    // moment of its history, where a planet thrown out of its orbit is gone
    // for good
    const years: number = Math.min(
      deltaTime * speed * YEARS_PER_SECOND,
      MAX_TICKS_PER_FRAME * MAX_TICK_YEARS
    );
    const ticks: number = clamp(
      Math.ceil(years / MAX_TICK_YEARS),
      1,
      MAX_TICKS_PER_FRAME
    );
    for (let tick = 0; tick < ticks; tick++) {
      this.worldService.calcNextTick(years / ticks);
      // every slice leaves its own mark, or a fast world draws a polygon
      if (showTrail) {
        this.worldService.recordTrails(trailLength);
      }
    }
    if (!showTrail) {
      // clearing what is there is a job for once a frame, not once a slice
      this.worldService.recordTrails(0);
    }
    this.updateSignals();
    const followed: WorldObject | null = this.followed();
    if (followed) {
      // the planets have moved, so the view has to move with the followed one
      this.centerOn(followed);
    }
    const target: WorldObject | null = this.menuTarget();
    if (target) {
      // a panel left open on a running world keeps telling the truth
      const primary: WorldObject | undefined = this.primaryOf(target);
      this.menuSpeed.set(target.vel.length());
      this.menuDistance.set(primary ? target.pos.dist(primary.pos) : 0);
    }
  }

  /**
   * What to call a planet in the list: the name it was born with, or its
   * place in the list for one that was put there by hand - a moon when it
   * circles a planet rather than the sun.
   */
  planetName(planet: Planet, index: number): string {
    if (PLANET_NAMES.has(planet.id)) {
      return planet.id;
    }
    const kind: string =
      planet.parent && planet.parent !== this.sun ? 'Moon' : 'Planet';
    return `${kind} ${index + 1}`;
  }

  /** How far a planet is from the sun, in AU - what its orbit amounts to. */
  distanceFromSun(planet: Planet): number {
    return planet.pos.dist(this.sun.pos);
  }

  /** Clears the world, resets the view and places sun and planets again. */
  reset(): void {
    this.stopSim();
    this.pausedForMenu = false;
    this.menuTarget.set(null);
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

  /** Creates a body of the given kind at the given world position. */
  private createObjectAt(pos: Vector2d, kind: ObjectKind): Planet {
    const planet: Planet = new Planet(pos, undefined, this.massOfKind(kind));
    planet.parent = this.sun;
    return planet;
  }

  /** Mass a body of the given kind is put down with, in solar masses. */
  private massOfKind(kind: ObjectKind): number {
    const { massOfSun } = this.settings();
    switch (kind) {
      case 'asteroid':
        return ASTEROID_MASS;
      case 'giant':
        return GIANT_MASS;
      case 'star':
        return massOfSun;
      default:
        // a planet keeps its place next to the sun however heavy that is set
        return placedPlanetMass(massOfSun);
    }
  }

  /** Takes the planet out of the world, handing its moons on to its parent. */
  removePlanet(planet: Planet): void {
    if (this.followed() === planet) {
      this.stopFollowing();
    }
    if (this.menuTarget() === planet) {
      this.menuClosed();
    }
    for (const other of this.planets()) {
      if (other.parent === planet) {
        other.parent = planet.parent ?? this.sun;
      }
    }
    this.worldService.removeWorldObject(planet);
    this.updateSignals();
  }
}

/** Restricts a value to the closed interval between `min` and `max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
