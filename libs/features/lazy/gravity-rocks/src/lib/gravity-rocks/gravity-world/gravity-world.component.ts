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
import { Vector2d } from '@wolsok/utils-math';
import { notNil } from '@wolsok/utils-operators';
import { WorldCamera } from './camera/world-camera';
import { GravityConfigComponent } from './config/gravity-config.component';
import { createSolarSystem } from './domain/create-solar-system';
import {
  GravityWorldConfig,
  INITIAL_CONFIG,
} from './domain/gravity-world-config';
import { GravityWorldService } from './domain/gravity-world.service';
import { SimulationRunner } from './domain/simulation-runner';
import { Force } from './domain/world-objects/force';
import { Planet } from './domain/world-objects/planet';
import { Sun } from './domain/world-objects/sun';
import {
  SvgPath,
  TrailSegment,
  svgPathForVelocity,
  trailToSvgSegments,
} from './domain/world-objects/svg-paths';
import { WorldObject } from './domain/world-objects/world-object';
import { WorldPointerController } from './interaction/world-pointer-controller';
import { ObjectPanelComponent } from './object-panel/object-panel.component';
import { OrbitTool } from './orbit-tool/orbit-tool';
import { WorldSelectionStore } from './selection/world-selection.store';
import { ToolbeltComponent } from './toolbelt/toolbelt.component';
import { ObjectKind, Tool } from './toolbelt/tools';

/**
 * Width of the world in AU. Six puts the orbit of mars, the outermost planet
 * the world starts with, inside the frame with room to spare.
 */
const SVG_VIEW_PORT_SIZE = 6;

const TRAIL_WIDTH_RATIO = 0.8;

/**
 * Binds the world to its template and wires its parts together: the camera,
 * the pointer controller, the selection and the simulation runner each own
 * their share of the behaviour.
 */
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
  public readonly worldService = inject(GravityWorldService);

  public MAX_DIM: Vector2d = Vector2d.create(
    SVG_VIEW_PORT_SIZE,
    (SVG_VIEW_PORT_SIZE / 5) * 3
  );

  @ViewChild('svgWorld')
  public svgWorld!: ElementRef<SVGSVGElement>;

  public readonly settings: WritableSignal<GravityWorldConfig> = signal(
    inject<GravityWorldConfig>(INITIAL_CONFIG)
  );

  public sun!: Sun;
  /** The bodies of the world, renewed whenever they have moved. */
  public readonly planets: Signal<Planet[]> = this.worldService.planets;

  public readonly forces: Signal<readonly Force[]> = this.worldService.forces;

  public canvasSize: WritableSignal<Vector2d> = signal(this.MAX_DIM);

  /** Where the world is looked at from: zoom, pan, and the body followed. */
  public readonly camera: WorldCamera = new WorldCamera({
    size: this.canvasSize,
    bodies: this.worldService.worldObjects,
    viewport: () => this.svgWorld?.nativeElement?.getBoundingClientRect(),
  });

  private readonly runner: SimulationRunner = new SimulationRunner({
    settings: this.settings,
    advance: (years, trailLength) =>
      this.worldService.advance(years, trailLength),
    // the planets have moved, so the view has to move with the followed one
    afterStep: () => this.camera.keepUp(),
  });

  protected readonly selection: WorldSelectionStore = new WorldSelectionStore({
    sun: () => this.sun,
    settings: this.settings,
    reach: computed(() => this.canvasSize().x / 2),
    objects: this.worldService,
    camera: this.camera,
    clock: this.runner,
  });

  private readonly pointer: WorldPointerController = new WorldPointerController(
    {
      camera: this.camera,
      orbitTool: this.selection.orbitTool,
      tool: this.selection.tool,
      running: this.runner.running,
      objects: this.worldService,
      svg: () => this.svgWorld?.nativeElement,
      intents: {
        tap: (wo) => this.selection.tap(wo),
        openMenu: (wo) => this.selection.openMenuFor(wo),
        place: (at) => this.selection.placeAt(at),
        discard: (planet) => this.selection.removePlanet(planet),
        placeSatellite: (parent, distance, angle) =>
          this.selection.addSatelliteTo(parent, distance, angle),
      },
    }
  );

  public readonly running: WritableSignal<boolean> = this.runner.running;
  /** What a press on the world does. */
  public readonly tool: WritableSignal<Tool> = this.selection.tool;
  /** What the add tool puts down. */
  public readonly addKind: WritableSignal<ObjectKind> = this.selection.addKind;
  /** World object whose settings panel is open, if any. */
  public readonly menuTarget: WritableSignal<WorldObject | null> =
    this.selection.menuTarget;
  public readonly orbitTool: OrbitTool = this.selection.orbitTool;

  public readonly forcesSvgPaths: Signal<SvgPath[]> = computed(() =>
    this.forces()
      .map((force) => force.svgPath())
      .filter(notNil)
  );

  /**
   * An arrow per body showing where its velocity takes it next, or nothing
   * at all while the setting is off - which it is until someone asks for it.
   */
  public readonly velocitySvgPath: Signal<SvgPath[]> = computed(() =>
    this.settings().showVelocity
      ? this.planets().map((planet) =>
          svgPathForVelocity(planet.id, planet.pos, planet.vel)
        )
      : []
  );

  /** Trail chunks of all planets, oldest and faintest first. */
  public readonly trailSegments: Signal<TrailSegment[]> = computed(() => {
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

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.pointer.dispose();
      this.runner.dispose();
    });
    this.initializeSunAndPlanets();

    effect(() =>
      this.worldService.setGravitationalConstant(
        this.settings().gravitationalConstant
      )
    );
    effect(() => (this.sun.mass = this.settings().massOfSun));
  }

  public pointerDown($event: PointerEvent): void {
    this.pointer.pointerDown($event);
  }

  public pointerUp($event: PointerEvent): void {
    this.pointer.pointerUp($event);
  }

  public pointerCancel($event: PointerEvent): void {
    this.pointer.pointerCancel($event);
  }

  public pointerMove($event: PointerEvent): void {
    this.pointer.pointerMove($event);
  }

  public wheel($event: WheelEvent): void {
    this.pointer.wheel($event);
  }

  public contextMenu($event: MouseEvent): void {
    this.pointer.contextMenu($event);
  }

  public menuClosed(): void {
    this.selection.menuClosed();
  }

  public removePlanet(planet: Planet): void {
    this.selection.removePlanet(planet);
  }

  public pickTool(tool: Tool): void {
    this.selection.pickTool(tool);
  }

  public planetName(planet: Planet, index: number): string {
    return this.selection.planetName(planet, index);
  }

  /** How far a planet is from the sun, in AU - what its orbit amounts to. */
  public distanceFromSun(planet: Planet): number {
    return planet.pos.dist(this.sun.pos);
  }

  public toggleSim(): void {
    this.runner.toggle();
  }

  public step(deltaTime: number): void {
    this.runner.step(deltaTime);
  }

  /** Clears the world, resets the view and places sun and planets again. */
  public reset(): void {
    this.runner.reset();
    this.selection.clear();
    this.worldService.removeAll();
    this.camera.reset();
    this.initializeSunAndPlanets();
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
}
