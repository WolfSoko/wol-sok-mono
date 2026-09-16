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
  ViewChild,
  WritableSignal,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
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
import { createSolarSystem } from './domain/create-solar-system';
import {
  GravityWorldService,
  MAX_TICK_YEARS,
  MAX_TICKS_PER_FRAME,
} from './domain/gravity-world.service';
import { Force } from './domain/world-objects/force';
import { SPRING_SPEED_PER_AU, SpringForce } from './interaction/spring-force';
import { Planet } from './domain/world-objects/planet';
import {
  defaultOrbitDistance,
  keepsSatelliteAt,
  orbitAround,
  placedPlanetMass,
  placementRange,
  primaryOf,
  satelliteMass,
  satelliteRadiusFor,
} from './domain/world-objects/orbit';
import { EARTH_MASS, PLANET_NAMES } from './domain/solar-system';
import { ObjectPanelComponent } from './object-panel/object-panel.component';
import { Sun } from './domain/world-objects/sun';
import {
  SvgPath,
  TrailSegment,
  svgPathForVelocity,
  trailToSvgSegments,
} from './domain/world-objects/svg-paths';
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
    hint: 'Put in orbit: tap a body, then press beside it and drag the orbit - let go to add the satellite',
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

/** The orbit the orbit tool draws before a satellite is let go onto it. */
export interface OrbitPreview {
  center: Vector2d;
  /** Distance of the orbit from its parent, in AU. */
  radius: number;
  /** Where on the orbit the satellite is put, in radians. */
  angle: number;
  /** Where the satellite is shown, and how big. */
  satellite: Vector2d;
  satelliteRadius: number;
  /** Whether the parent keeps a satellite there, see `keepsSatelliteAt`. */
  held: boolean;
}

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
  // a world of its own, so leaving the route takes its planets with it
  providers: [GravityWorldService],
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatListModule,
    MatIconModule,
    MatTooltipModule,
    GravityConfigComponent,
    MatSidenavModule,
    MatButtonToggleModule,
    ObjectPanelComponent,
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
  /** The bodies of the world, renewed whenever they have moved. */
  readonly planets: Signal<Planet[]> = this.worldService.planets;

  readonly forces: Signal<readonly Force[]> = this.worldService.forces;
  forcesSvgPaths: Signal<SvgPath[]> = computed(() =>
    this.forces()
      .map((force) => force.svgPath())
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

  /** Whether the simulation was running when the menu took over. */
  private pausedForMenu = false;

  /**
   * Body the orbit tool has picked to circle, and where its pointer was seen
   * last - together they draw the orbit the next satellite is let go onto.
   */
  readonly orbitParent: WritableSignal<WorldObject | null> = signal(null);
  private readonly orbitPointer: WritableSignal<Vector2d | null> = signal(null);
  /** The pointer holding the drawn orbit, while one is pressed on it. */
  private orbitPointerId: number | null = null;

  /**
   * The orbit the orbit tool draws around its parent: as far out as the
   * pointer, within what the parent can offer, with the satellite shown where
   * the pointer is. Nothing until a parent is picked.
   */
  readonly orbitPreview: Signal<OrbitPreview | null> = computed(() => {
    const parent: WorldObject | null = this.orbitParent();
    // the parent moves while the world runs, and `planets` is set each frame
    this.planets();
    if (!parent) {
      return null;
    }
    const { gravitationalConstant } = this.settings();
    const primary: WorldObject | undefined = this.primaryOf(parent);
    const radiusOfSatellite: number = satelliteRadiusFor(parent);
    const { min, max } = placementRange(
      parent,
      primary,
      radiusOfSatellite,
      gravitationalConstant,
      this.canvasSize().x / 2
    );
    const pointer: Vector2d | null = this.orbitPointer();
    const towards: Vector2d | null =
      pointer && pointer.dist(parent.pos) > 0 ? pointer.sub(parent.pos) : null;
    const radius: number = clamp(
      towards
        ? towards.length()
        : defaultOrbitDistance(parent, primary, radiusOfSatellite),
      min,
      max
    );
    const angle: number = towards ? Math.atan2(towards.y, towards.x) : 0;
    return {
      center: parent.pos,
      radius,
      angle,
      satellite: parent.pos.add(
        vec2(Math.cos(angle), Math.sin(angle)).mul(radius)
      ),
      satelliteRadius: radiusOfSatellite,
      held: keepsSatelliteAt(parent, primary, radius),
    };
  });

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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelLongPress());
    this.settings = signal(this.initialConfig);
    this.initializeSunAndPlanets();

    effect(() =>
      this.worldService.setGravitationalConstant(
        this.settings().gravitationalConstant
      )
    );
    effect(() => (this.sun.mass = this.settings().massOfSun));
    effect(() => (this.running() ? this.gameLoop() : null));
  }

  /** Puts the sun in the middle of the world and the inner planets around it. */
  private initializeSunAndPlanets(): void {
    const { massOfSun, gravitationalConstant } = this.settings();
    const { sun, planets } = createSolarSystem(
      this.canvasSize().div(2),
      massOfSun,
      gravitationalConstant
    );
    this.sun = sun;
    this.worldService.addWorldObject(sun);
    for (const planet of planets) {
      this.worldService.addWorldObject(planet);
    }
  }

  private findWorldObject(target: SVGElement): WorldObject | undefined {
    return this.worldService.worldObjects().find((wo) => wo.id === target.id);
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
    } else if (tool === 'orbit' && this.orbitParent()) {
      // a press beside the picked body takes hold of the drawn orbit
      this.orbitPointerId = $event.pointerId;
      this.orbitPointer.set(this.toWorldCoordinates($event));
      return;
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
  }

  /**
   * Ends the current pan or drag gesture, and taps the object it was on - or
   * lets a satellite go onto the orbit the pointer was holding.
   */
  pointerUp($event: PointerEvent): void {
    const heldOrbit: boolean = this.orbitPointerId === $event.pointerId;
    const pressed = this.endGesture($event);
    if (heldOrbit) {
      // a mouse keeps its pointer id, so the next press must start afresh
      this.orbitPointerId = null;
      this.orbitPointer.set(this.toWorldCoordinates($event));
      this.placeOnDrawnOrbit();
    } else if (pressed && this.isWithinClickTolerance(pressed, $event)) {
      this.tap(pressed.wo);
    }
  }

  /** Puts a satellite where the drawn orbit shows it. */
  private placeOnDrawnOrbit(): void {
    const parent: WorldObject | null = this.orbitParent();
    const preview: OrbitPreview | null = this.orbitPreview();
    if (parent && preview) {
      this.addSatelliteTo(parent, preview.radius, preview.angle);
    }
  }

  /** What a tap on a body does, by the tool in hand. */
  private tap(wo: WorldObject): void {
    switch (this.tool()) {
      case 'select':
        this.openMenuFor(wo);
        break;
      case 'orbit':
        // the orbit is drawn from here on, the satellite follows on release
        this.orbitParent.set(wo);
        this.orbitPointer.set(null);
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
    if (this.orbitPointerId === $event.pointerId) {
      this.orbitPointerId = null;
    }
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
    this.worldService.refresh();
  }

  /** Drops the running drag, taking back the planet it has just created. */
  private cancelDrag(): void {
    this.cancelLongPress();
    const created = this.createdByDrag;
    this.panStart = null;
    this.pressed = null;
    this.dragPointerId = null;
    this.orbitPointerId = null;
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
    if (
      this.orbitParent() &&
      this.tool() === 'orbit' &&
      // the pointer holding the orbit, or a mouse hovering with none pressed
      (this.orbitPointerId === $event.pointerId ||
        this.activePointers.size === 0)
    ) {
      this.orbitPointer.set(this.toWorldCoordinates($event));
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
    if (this.orbitPointerId !== null) {
      // a finger resting on the drawn orbit is still holding it - the
      // browser's long press must neither show its menu nor cut the gesture
      // short, the satellite follows on release as it would have
      $event.preventDefault();
      return;
    }
    const wo: WorldObject | undefined = this.findWorldObject(
      $event.target as SVGElement
    );
    if (!wo) {
      return;
    }
    $event.preventDefault();
    if (this.activePointers.size > 0) {
      // a finger is still down: the browser's own long press got here before
      // ours, so let go of the body as `startLongPress` would, or lifting the
      // finger flings it - and eat the click that lift turns into
      this.cancelDrag();
      this.swallowNextClick();
    }
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
  }

  /** What holds `target` on its own orbit, with the sun of this world. */
  private primaryOf(target: WorldObject): WorldObject | undefined {
    return primaryOf(target, this.sun);
  }

  /** Forgets the target and picks the simulation back up where it left off. */
  menuClosed(): void {
    this.menuTarget.set(null);
    if (this.pausedForMenu) {
      this.pausedForMenu = false;
      this.running.set(true);
    }
  }

  /**
   * Puts a satellite in a circular orbit around `parent`, at `distance` and
   * `angle` - or where one is placed by default, anywhere on the circle.
   */
  addSatelliteTo(
    parent: WorldObject,
    distance: number = defaultOrbitDistance(
      parent,
      this.primaryOf(parent),
      satelliteRadiusFor(parent)
    ),
    angle: number = Math.random() * 2 * Math.PI
  ): void {
    const satellite: Planet = this.createSatelliteFor(parent);
    const { pos, vel } = orbitAround(
      parent,
      distance,
      angle,
      this.settings().gravitationalConstant
    );
    satellite.pos = pos;
    satellite.vel = vel;
    this.worldService.addWorldObject(satellite);
  }

  /** Takes the object of the panel out of the world, and the panel with it. */
  removeTarget(): void {
    const target: WorldObject | null = this.menuTarget();
    if (target instanceof Planet) {
      this.removePlanet(target);
    }
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
    const angle: number = Math.atan2(
      target.pos.y - parent.pos.y,
      target.pos.x - parent.pos.x
    );
    const { pos, vel } = orbitAround(
      parent,
      distance,
      angle,
      this.settings().gravitationalConstant
    );
    target.pos = pos;
    target.vel = vel;
    this.worldService.refresh();
  }

  /** The satellite the menu target would be given: its moon, or its planet. */
  private createSatelliteFor(parent: WorldObject): Planet {
    const satellite: Planet = new Planet(
      parent.pos,
      undefined,
      satelliteMass(parent)
    );
    satellite.parent = parent;
    return satellite;
  }

  /** Gives the object of the panel the mass it asks for, in solar masses. */
  setMass(mass: number): void {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return;
    }
    if (target === this.sun) {
      // the sun takes its mass from the settings, so it has to change there -
      // but the effect handing it over only runs once this turn is done, and
      // the orbit below reads the sun's radius right away
      this.sun.mass = mass;
      this.settings.update((settings) => ({ ...settings, massOfSun: mass }));
    } else {
      target.mass = mass;
    }
    // its disc has changed, which can grow it into its parent's - move it
    // back onto a valid orbit if its real place no longer is one, otherwise
    // leave it be: a mass tweak is not a request to move it
    const parent: WorldObject | undefined = this.primaryOf(target);
    if (parent) {
      const current: number = target.pos.dist(parent.pos);
      const { min, max } = placementRange(
        parent,
        this.primaryOf(parent),
        target.radius,
        this.settings().gravitationalConstant,
        this.canvasSize().x / 2
      );
      const clamped: number = clamp(current, min, max);
      if (clamped !== current) {
        this.setDistance(clamped);
      }
    }
    this.worldService.refresh();
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
    target.vel = direction.mul(speed);
    this.worldService.refresh();
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
   * Advances the simulation by a single frame of the given length. How much
   * world time that frame is worth is what the simulation speed decides; how
   * that time is safely integrated is the world's own business.
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
    this.worldService.advance(years, showTrail ? trailLength : 0);
    const followed: WorldObject | null = this.followed();
    if (followed) {
      // the planets have moved, so the view has to move with the followed one
      this.centerOn(followed);
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

  /** Puts the given tool in hand, dropping what the orbit tool had picked. */
  pickTool(tool: Tool): void {
    this.tool.set(tool);
    this.orbitParent.set(null);
    this.orbitPointer.set(null);
    this.orbitPointerId = null;
  }

  /** Clears the world, resets the view and places sun and planets again. */
  reset(): void {
    this.stopSim();
    this.pausedForMenu = false;
    this.menuTarget.set(null);
    this.orbitParent.set(null);
    this.orbitPointer.set(null);
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
    if (this.orbitParent() === planet) {
      this.orbitParent.set(null);
    }
    for (const other of this.planets()) {
      if (other.parent === planet) {
        other.parent = planet.parent ?? this.sun;
      }
    }
    this.worldService.removeWorldObject(planet);
  }
}

/** Restricts a value to the closed interval between `min` and `max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
