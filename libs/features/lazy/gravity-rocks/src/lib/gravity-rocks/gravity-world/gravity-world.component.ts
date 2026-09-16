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
import { clamp } from './domain/clamp';
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
  orbitAround,
  placedPlanetMass,
  placementRange,
  primaryOf,
  satelliteMass,
  satelliteRadiusFor,
} from './domain/world-objects/orbit';
import { EARTH_MASS, PLANET_NAMES } from './domain/solar-system';
import { ObjectPanelComponent } from './object-panel/object-panel.component';
import { OrbitTool } from './orbit-tool/orbit-tool';
import { ClientPoint, clientPoint, WorldCamera } from './camera/world-camera';
import {
  isWithinClickTolerance,
  PointerTracker,
} from './interaction/pointer-tracker';
import { swallowNextClick } from './interaction/swallow-next-click';
import { ToolbeltComponent } from './toolbelt/toolbelt.component';
import { ObjectKind, Tool } from './toolbelt/tools';
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

const TRAIL_WIDTH_RATIO = 0.8;
/**
 * World time one second of watching is worth, in years. A tenth takes the
 * earth ten seconds to go round the sun at the usual speed - slow enough to
 * follow, fast enough not to wait for mars.
 */
export const YEARS_PER_SECOND = 0.1;
const RIGHT_BUTTON = 2;

/**
 * A thousandth of an earth, the lightest the mass slider goes; a jupiter, at
 * 318 earths; and a star weighs whatever the sun is set to.
 */
const ASTEROID_MASS = EARTH_MASS / 1000;
const GIANT_MASS = EARTH_MASS * 318;

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
    ObjectPanelComponent,
    ToolbeltComponent,
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

  /** What a press on the world does. */
  readonly tool: WritableSignal<Tool> = signal('grab');
  /** What the add tool puts down. */
  readonly addKind: WritableSignal<ObjectKind> = signal('planet');

  public running = signal(false);
  sun!: Sun;
  /** The bodies of the world, renewed whenever they have moved. */
  readonly planets: Signal<Planet[]> = this.worldService.planets;

  readonly forces: Signal<readonly Force[]> = this.worldService.forces;

  canvasSize: WritableSignal<Vector2d> = signal(this.MAX_DIM);

  /** Where the world is looked at from: zoom, pan, and the body followed. */
  readonly camera: WorldCamera = new WorldCamera({
    size: this.canvasSize,
    bodies: this.worldService.worldObjects,
    viewport: () => this.svgWorld?.nativeElement?.getBoundingClientRect(),
  });
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

  /** The pointers on the world, and what they went down on. */
  private readonly pointers = new PointerTracker<WorldObject>();

  /** The pointer driving the current drag, and the planet it created. */
  private dragPointerId: number | null = null;
  private createdByDrag: Planet | null = null;

  /** What the drag holds, where it started, and where it has been taken. */
  private dragObject: WorldObject | null = null;
  private dragOrigin: ClientPoint | null = null;
  private dragEnd: Vector2d | null = null;

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

  /** Putting a body in orbit around another, in two presses. */
  readonly orbitTool: OrbitTool = new OrbitTool({
    sun: () => this.sun,
    bodies: this.worldService.worldObjects,
    gravitationalConstant: computed(
      () => this.settings().gravitationalConstant
    ),
    reach: computed(() => this.canvasSize().x / 2),
  });

  /** What the tool in hand is waiting for, shown next to the toolbelt. */
  readonly toolHint: Signal<string | null> = computed(() => {
    if (this.tool() !== 'orbit') {
      return null;
    }
    const parent: WorldObject | null = this.orbitTool.parent();
    if (!parent) {
      return 'Tap a body to give it a satellite';
    }
    const satellite: string = parent === this.sun ? 'planet' : 'moon';
    return `Press beside it and drag the orbit, let go to add the ${satellite}`;
  });

  drag$: Observable<{ end: Vector2d }> = this.pointerDown$.asObservable().pipe(
    take(1),
    switchMap(() =>
      this.pointerMove$.asObservable().pipe(
        map((pm: PointerEvent) => ({
          end: this.camera.toWorld(pm),
        })),
        takeUntil(this.gestureEnd$.asObservable())
      )
    )
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pointers.cancelLongPress());
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
    if (this.pointers.count >= 2) {
      // two fingers already own the gesture, a third would only confuse it
      return;
    }
    this.pointers.add($event.pointerId, $event);
    // keep receiving moves once the gesture wanders off the svg - the second
    // finger needs that just as much as the first
    this.svgWorld?.nativeElement?.setPointerCapture?.($event.pointerId);
    const pair = this.pointers.pair;
    if (pair) {
      // the first finger was only ever the start of a two finger gesture
      this.cancelDrag();
      this.camera.startPinch(...pair);
      return;
    }
    if (this.isPanGesture($event)) {
      this.startPanning($event);
      return;
    }
    const tool: Tool = this.tool();
    let wo = this.findWorldObject($event.target as SVGElement);
    if (wo) {
      this.pointers.pressOn(wo, $event);
      if ($event.pointerType !== 'mouse') {
        // touch has no right button, so resting on an object opens the panel
        this.startLongPress(wo);
      }
      if (tool !== 'grab' && tool !== 'add') {
        // the other tools act on the tap, there is nothing to drag
        return;
      }
    } else if (tool === 'orbit' && this.orbitTool.parent()) {
      // a press beside the picked body takes hold of the drawn orbit
      this.orbitTool.grab($event.pointerId, this.camera.toWorld($event));
      return;
    } else if (tool === 'add') {
      // a click on empty space places a body, it does not move the view
      const created: Planet = this.createObjectAt(
        this.camera.toWorld($event),
        this.addKind()
      );
      this.worldService.addWorldObject(created);
      this.createdByDrag = created;
      wo = created;
    } else {
      this.startPanning($event);
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
    const heldOrbit: boolean = this.orbitTool.isHeldBy($event.pointerId);
    const pressed = this.endGesture($event);
    if (heldOrbit) {
      const placed = this.orbitTool.release(this.camera.toWorld($event));
      if (placed) {
        this.addSatelliteTo(
          placed.parent,
          placed.orbit.radius,
          placed.orbit.angle
        );
      }
    } else if (pressed && isWithinClickTolerance(pressed.at, $event)) {
      this.tap(pressed.subject);
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
        this.orbitTool.pick(wo);
        break;
      case 'delete':
        if (wo instanceof Planet) {
          this.removePlanet(wo);
        }
        break;
      default:
        this.camera.toggleFollow(wo);
    }
  }

  /** Ends the gesture without following, the system took the pointer away. */
  pointerCancel($event: PointerEvent): void {
    // a placement the system cut short was never finished
    const created: Planet | null = this.createdByDrag;
    if (this.orbitTool.isHeldBy($event.pointerId)) {
      this.orbitTool.letGo();
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
  ): { subject: WorldObject; at: ClientPoint } | null {
    this.pointers.remove($event.pointerId);
    const svg: SVGSVGElement | undefined = this.svgWorld?.nativeElement;
    if (svg?.hasPointerCapture?.($event.pointerId)) {
      svg.releasePointerCapture($event.pointerId);
    }
    this.pointers.cancelLongPress();
    if (this.camera.isPinching) {
      // the finger left over must not carry on as a drag of its own
      if (this.pointers.count < 2) {
        this.camera.endGesture();
      }
      return null;
    }
    const pressed = this.pointers.takePress();
    this.camera.endGesture();
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
    this.pointers.cancelLongPress();
    const created = this.createdByDrag;
    this.camera.endGesture();
    this.pointers.dropPress();
    this.dragPointerId = null;
    this.orbitTool.letGo();
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
    this.pointers.moveTo($event.pointerId, $event);
    if (this.camera.isPinching) {
      const pair = this.pointers.pair;
      if (pair) {
        this.camera.pinchTo(...pair);
      }
      return;
    }
    if (this.camera.isPanning) {
      this.camera.panTo($event);
      return;
    }
    if (
      this.orbitTool.parent() &&
      this.tool() === 'orbit' &&
      // the pointer holding the orbit, or a mouse hovering with none pressed
      (this.orbitTool.isHeldBy($event.pointerId) || this.pointers.count === 0)
    ) {
      this.orbitTool.moveTo(this.camera.toWorld($event));
    }
    if (this.pointers.hasWandered($event)) {
      // the gesture has become a drag, releasing it must not center anything,
      // not even when the pointer comes back to where it started
      this.pointers.dropPress();
      this.pointers.cancelLongPress();
    }
    if (this.dragPointerId === $event.pointerId) {
      const origin: ClientPoint | null = this.dragOrigin;
      if (origin && !isWithinClickTolerance(origin, $event)) {
        // a gesture this long is a drag, and a drag can throw
        this.dragEnd = this.camera.toWorld($event);
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
    this.camera.zoomAt($event, $event.deltaY < 0);
  }

  /** Panning is the middle mouse button, or a drag with a modifier held. */
  private isPanGesture($event: PointerEvent): boolean {
    return (
      $event.button === 1 || $event.shiftKey || $event.ctrlKey || $event.metaKey
    );
  }

  /** Starts moving the view with the pointer, rather than anything in it. */
  private startPanning($event: PointerEvent): void {
    $event.preventDefault();
    this.camera.startPan($event);
  }

  /** Opens the settings of the object under the cursor on a right click. */
  contextMenu($event: MouseEvent): void {
    if (this.orbitTool.isHeld) {
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
    if (this.pointers.count > 0) {
      // a finger is still down: the browser's own long press got here before
      // ours, so let go of the body as `startLongPress` would, or lifting the
      // finger flings it - and eat the click that lift turns into
      this.cancelDrag();
      swallowNextClick();
    }
    this.openMenuFor(wo);
  }

  /** A finger resting on an object opens its settings, like a right click. */
  private startLongPress(wo: WorldObject): void {
    this.pointers.startLongPress(() => {
      // the finger is still down, so let go of the object before the panel
      // takes over - otherwise it would be flung when the finger lifts
      this.cancelDrag();
      this.openMenuFor(wo);
      // and it is still down now, so the click it turns into is still coming
      swallowNextClick();
    });
  }

  /** Opens the settings panel for the given object, pausing the world. */
  private openMenuFor(wo: WorldObject): void {
    this.pointers.cancelLongPress();
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
    // the planets have moved, so the view has to move with the followed one
    this.camera.keepUp();
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
    this.orbitTool.clear();
  }

  /** Clears the world, resets the view and places sun and planets again. */
  reset(): void {
    this.stopSim();
    this.pausedForMenu = false;
    this.menuTarget.set(null);
    this.orbitTool.clear();
    this.worldService.removeAll();
    this.camera.reset();
    this.initializeSunAndPlanets();
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
    this.camera.forget(planet);
    if (this.menuTarget() === planet) {
      this.menuClosed();
    }
    this.orbitTool.forget(planet);
    for (const other of this.planets()) {
      if (other.parent === planet) {
        other.parent = planet.parent ?? this.sun;
      }
    }
    this.worldService.removeWorldObject(planet);
  }
}
