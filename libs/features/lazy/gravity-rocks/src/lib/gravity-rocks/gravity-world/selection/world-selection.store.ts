import { computed, Signal, signal, WritableSignal } from '@angular/core';
import { vec2, Vector2d } from '@wolsok/utils-math';
import { WorldCamera } from '../camera/world-camera';
import { clamp } from '../domain/clamp';
import { GravityWorldConfig } from '../domain/gravity-world-config';
import { GravityWorldService } from '../domain/gravity-world.service';
import { SimulationRunner } from '../domain/simulation-runner';
import { PLANET_NAMES } from '../domain/solar-system';
import {
  defaultOrbitDistance,
  orbitAround,
  placementRange,
  primaryOf,
  satelliteRadiusFor,
} from '../domain/world-objects/orbit';
import { Planet } from '../domain/world-objects/planet';
import { Sun } from '../domain/world-objects/sun';
import { WorldObject } from '../domain/world-objects/world-object';
import { OrbitTool } from '../orbit-tool/orbit-tool';
import { ObjectKind, Tool } from '../toolbelt/tools';
import { createBodyAt, createSatelliteFor } from './body-factory';

/** What the selection has to ask, and tell, the world it edits. */
export interface WorldSelectionWorld {
  /** The sun of the world, which is renewed on every reset. */
  sun(): Sun;
  settings: WritableSignal<GravityWorldConfig>;
  /** Furthest a body may be placed from anything, in AU. */
  reach: Signal<number>;
  objects: Pick<
    GravityWorldService,
    | 'worldObjects'
    | 'planets'
    | 'addWorldObject'
    | 'removeWorldObject'
    | 'refresh'
  >;
  camera: Pick<WorldCamera, 'forget' | 'toggleFollow'>;
  clock: Pick<SimulationRunner, 'suspend' | 'resume'>;
}

/**
 * The tool in hand, the body whose settings panel is open, and everything
 * that panel and the tools do to the bodies of the world.
 *
 * Plain signals and world edits - no DOM, no events. Which body a press
 * landed on is the pointer controller's business; this only hears about it.
 */
export class WorldSelectionStore {
  /** What a press on the world does. */
  public readonly tool: WritableSignal<Tool> = signal('grab');
  /** What the add tool puts down. */
  public readonly addKind: WritableSignal<ObjectKind> = signal('planet');
  /** World object whose settings panel is open, if any. */
  public readonly menuTarget: WritableSignal<WorldObject | null> = signal(null);

  /** Putting a body in orbit around another, in two presses. */
  public readonly orbitTool: OrbitTool;

  /** What the panel calls its target. */
  public readonly menuTitle: Signal<string> = computed(() => {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return '';
    }
    if (!(target instanceof Planet)) {
      return 'Sun';
    }
    return this.planetName(
      target,
      this.world.objects.planets().indexOf(target)
    );
  });

  /** What the tool in hand is waiting for, shown next to the toolbelt. */
  public readonly toolHint: Signal<string | null> = computed(() => {
    if (this.tool() !== 'orbit') {
      return null;
    }
    const parent: WorldObject | null = this.orbitTool.parent();
    if (!parent) {
      return 'Tap a body to give it a satellite';
    }
    const satellite: string = parent === this.world.sun() ? 'planet' : 'moon';
    return `Press beside it and drag the orbit, let go to add the ${satellite}`;
  });

  public constructor(private readonly world: WorldSelectionWorld) {
    this.orbitTool = new OrbitTool({
      sun: () => world.sun(),
      bodies: world.objects.worldObjects,
      gravitationalConstant: computed(
        () => world.settings().gravitationalConstant
      ),
      reach: world.reach,
    });
  }

  /** Puts the given tool in hand, dropping what the orbit tool had picked. */
  public pickTool(tool: Tool): void {
    this.tool.set(tool);
    this.orbitTool.clear();
  }

  /** What a tap on a body does, by the tool in hand. */
  public tap(wo: WorldObject): void {
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
        this.world.camera.toggleFollow(wo);
    }
  }

  /** Opens the settings panel for the given object, pausing the world. */
  public openMenuFor(wo: WorldObject): void {
    // sliders on a moving object would set what has already moved on - and a
    // world the panel already paused for one body stays owed its restart
    // when the panel moves on to another
    this.world.clock.suspend();
    this.menuTarget.set(wo);
  }

  /** Forgets the target and picks the simulation back up where it left off. */
  public menuClosed(): void {
    this.menuTarget.set(null);
    this.world.clock.resume();
  }

  /** Drops the panel and whatever the orbit tool had picked. */
  public clear(): void {
    this.menuTarget.set(null);
    this.orbitTool.clear();
  }

  /** Puts a body of the kind the add tool holds at `pos`, and returns it. */
  public placeAt(pos: Vector2d): Planet {
    const created: Planet = createBodyAt(
      pos,
      this.addKind(),
      this.world.sun(),
      this.world.settings().massOfSun
    );
    this.world.objects.addWorldObject(created);
    return created;
  }

  /**
   * Puts a satellite in a circular orbit around `parent`, at `distance` and
   * `angle` - or where one is placed by default, anywhere on the circle.
   */
  public addSatelliteTo(
    parent: WorldObject,
    distance: number = defaultOrbitDistance(
      parent,
      this.primaryOf(parent),
      satelliteRadiusFor(parent)
    ),
    angle: number = Math.random() * 2 * Math.PI
  ): void {
    const satellite: Planet = createSatelliteFor(parent);
    const { pos, vel } = orbitAround(
      parent,
      distance,
      angle,
      this.world.settings().gravitationalConstant
    );
    satellite.pos = pos;
    satellite.vel = vel;
    this.world.objects.addWorldObject(satellite);
  }

  /** Takes the object of the panel out of the world, and the panel with it. */
  public removeTarget(): void {
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
  public setDistance(distance: number): void {
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
      this.world.settings().gravitationalConstant
    );
    target.pos = pos;
    target.vel = vel;
    this.world.objects.refresh();
  }

  /** Gives the object of the panel the mass it asks for, in solar masses. */
  public setMass(mass: number): void {
    const target: WorldObject | null = this.menuTarget();
    if (!target) {
      return;
    }
    const sun: Sun = this.world.sun();
    if (target === sun) {
      // the sun takes its mass from the settings, so it has to change there -
      // but the effect handing it over only runs once this turn is done, and
      // the orbit below reads the sun's radius right away
      sun.mass = mass;
      this.world.settings.update((settings) => ({
        ...settings,
        massOfSun: mass,
      }));
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
        this.world.settings().gravitationalConstant,
        this.world.reach()
      );
      const clamped: number = clamp(current, min, max);
      if (clamped !== current) {
        this.setDistance(clamped);
      }
    }
    this.world.objects.refresh();
  }

  /**
   * Sets how fast the menu target travels, keeping its direction. An object at
   * rest is sent into the direction it would need to orbit the sun.
   */
  public setSpeed(speed: number): void {
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
    this.world.objects.refresh();
  }

  /** Takes the planet out of the world, handing its moons on to its parent. */
  public removePlanet(planet: Planet): void {
    this.world.camera.forget(planet);
    if (this.menuTarget() === planet) {
      this.menuClosed();
    }
    this.orbitTool.forget(planet);
    for (const other of this.world.objects.planets()) {
      if (other.parent === planet) {
        other.parent = planet.parent ?? this.world.sun();
      }
    }
    this.world.objects.removeWorldObject(planet);
  }

  /**
   * What to call a planet in the list: the name it was born with, or its
   * place in the list for one that was put there by hand - a moon when it
   * circles a planet rather than the sun.
   */
  public planetName(planet: Planet, index: number): string {
    if (PLANET_NAMES.has(planet.id)) {
      return planet.id;
    }
    const kind: string =
      planet.parent && planet.parent !== this.world.sun() ? 'Moon' : 'Planet';
    return `${kind} ${index + 1}`;
  }

  /** What holds `target` on its own orbit, with the sun of this world. */
  private primaryOf(target: WorldObject): WorldObject | undefined {
    return primaryOf(target, this.world.sun());
  }

  /** Direction an object at its place would orbit the sun in. */
  private orbitDirectionAroundSun(wo: WorldObject): Vector2d {
    const sun: Sun = this.world.sun();
    if (wo === sun || wo.pos.dist(sun.pos) === 0) {
      return vec2(1, 0);
    }
    return wo.pos.orthogonalTo(sun.pos);
  }
}
