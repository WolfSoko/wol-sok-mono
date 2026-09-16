import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { EARTH_MASS } from '../domain/solar-system';
import {
  defaultOrbitDistance,
  keepsSatelliteAt,
  placementRange,
  primaryOf,
  satelliteRadiusFor,
} from '../domain/world-objects/orbit';
import { WorldObject } from '../domain/world-objects/world-object';

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
/** Smallest step a slider may take, so a range with nothing in it still works. */
const MIN_SLIDER_STEP = 1e-4;

/** Restricts a value to the closed interval between `min` and `max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Everything one body can be told to be: how far out it sits, how heavy it
 * is, how fast it travels, and what it is given for a satellite.
 *
 * The panel owns where its sliders stand, and nothing else. The world objects
 * are mutable and carry no signals of their own, so a slider reading their
 * fields would never notice a change - it holds the number it was set to and
 * hands it out, and the world is what applies it.
 */
@Component({
  selector: 'feat-lazy-gravity-object-panel',
  templateUrl: 'object-panel.component.html',
  styleUrls: ['object-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatSliderModule,
  ],
})
export class ObjectPanelComponent {
  /** The body the panel edits. */
  readonly target: InputSignal<WorldObject> = input.required<WorldObject>();
  /** The sun, which is how a body is asked what holds it. */
  readonly sun: InputSignal<WorldObject> = input.required<WorldObject>();
  /** What the panel calls its target. */
  readonly title: InputSignal<string> = input.required<string>();
  readonly gravitationalConstant: InputSignal<number> =
    input.required<number>();
  /** Furthest a satellite may be placed from anything, in AU. */
  readonly reach: InputSignal<number> = input.required<number>();
  /**
   * The bodies of the world. Read for its identity rather than its contents:
   * a new array is the world saying that everything in it may have moved, and
   * a panel left open on a running world has to keep telling the truth.
   */
  readonly world: InputSignal<readonly WorldObject[]> =
    input.required<readonly WorldObject[]>();

  readonly closed: OutputEmitterRef<void> = output<void>();
  /** A new mass for the target, in solar masses. */
  readonly massChange: OutputEmitterRef<number> = output<number>();
  /** How far the target itself should sit from its primary, in AU. */
  readonly distanceChange: OutputEmitterRef<number> = output<number>();
  /** How fast the target should travel, in AU/year. */
  readonly speedChange: OutputEmitterRef<number> = output<number>();
  /** Put a satellite in orbit around the target, this far out. */
  readonly addSatellite: OutputEmitterRef<number> = output<number>();
  readonly remove: OutputEmitterRef<void> = output<void>();

  readonly minMassExponent = MIN_MASS_EXPONENT;
  readonly maxMassExponent = MAX_MASS_EXPONENT;
  readonly maxSpeed = MAX_SPEED;

  /** Where the mass slider stands, on the log scale of earth masses. */
  readonly massExponent: WritableSignal<number> = signal(MIN_MASS_EXPONENT);
  /**
   * Mass of the target in earth masses. Kept next to the exponent rather than
   * derived from it: a mass set in the settings can sit outside the slider
   * range, and then the label still has to tell the truth.
   */
  readonly mass: WritableSignal<number> = signal(0);
  readonly speed: WritableSignal<number> = signal(0);
  /** How far from the target its next satellite is placed. */
  readonly orbit: WritableSignal<number> = signal(0);
  /** How far the target itself sits from its own primary. */
  readonly distance: WritableSignal<number> = signal(0);

  /** What holds the target: the sun for a planet, the planet for a moon. */
  readonly primary: Signal<WorldObject | undefined> = computed(() =>
    primaryOf(this.target(), this.sun())
  );

  /** What the target orbits. Empty for the sun, which orbits nothing. */
  readonly parentName: Signal<string> = computed(() => {
    const primary: WorldObject | undefined = this.primary();
    if (!primary) {
      return '';
    }
    return primary === this.sun() ? 'sun' : 'planet';
  });

  /** What a satellite of the target would be: a planet, or a moon. */
  readonly satelliteName: Signal<string> = computed(() =>
    this.target() === this.sun() ? 'planet' : 'moon'
  );

  /**
   * How far a satellite of the target may sit from it. Mass decides both
   * discs and the reach of the target's gravity, speed decides how tightly a
   * satellite may circle it, so the range follows both sliders - which are
   * read here only to follow them, the sizes come from the target itself.
   */
  readonly orbitRange: Signal<{ min: number; max: number }> = computed(() => {
    const target: WorldObject = this.target();
    const mass: number = this.mass();
    this.speed();
    if (mass <= 0) {
      return { min: 0, max: 0 };
    }
    return placementRange(
      target,
      this.primary(),
      satelliteRadiusFor(target),
      this.gravitationalConstant(),
      this.reach()
    );
  });

  /**
   * How far the target itself may be moved from its own primary: the same
   * rule `orbitRange` places a new satellite by, applied to the target.
   */
  readonly distanceRange: Signal<{ min: number; max: number }> = computed(
    () => {
      const target: WorldObject = this.target();
      const primary: WorldObject | undefined = this.primary();
      // read only to follow the mass slider, like `orbitRange` does
      const mass: number = this.mass();
      if (!primary || mass <= 0) {
        // the sun has no parent to move against
        return { min: 0, max: 0 };
      }
      return placementRange(
        primary,
        primaryOf(primary, this.sun()),
        target.radius,
        this.gravitationalConstant(),
        this.reach()
      );
    }
  );

  /**
   * Step of a slider: a hundredth of what it can cover. A fixed step cannot
   * do - the range is a few hundredths of an AU around a planet and a few
   * whole ones around the sun.
   */
  readonly orbitStep: Signal<number> = computed(() =>
    stepFor(this.orbitRange())
  );
  readonly distanceStep: Signal<number> = computed(() =>
    stepFor(this.distanceRange())
  );

  /**
   * Whether the target keeps a satellite on the orbit the slider is set to,
   * or its own primary takes it away in time - which is every orbit a light
   * planet can offer, and what its mass slider is there to fix.
   */
  readonly held: Signal<boolean> = computed(() => {
    // read to follow the mass slider, and the distance to the primary, which
    // a running world keeps moving
    this.mass();
    this.distance();
    return keepsSatelliteAt(this.target(), this.primary(), this.orbit());
  });

  constructor() {
    // a target the panel is handed fills every slider from what it is now
    effect(() => {
      const target: WorldObject = this.target();
      untracked(() => this.readFrom(target));
    });
    // and whenever the world moves it on - a running simulation, or a change
    // the world made of its own accord out of one the panel asked for - the
    // numbers shown are read back off the body rather than kept from what
    // was asked for, so they cannot drift from where it really is
    effect(() => {
      this.world();
      untracked(() => this.followTarget());
    });
  }

  /** Sets the mass of the target from the log scale of the slider. */
  setMassExponent(exponent: number): void {
    this.massExponent.set(
      clamp(exponent, MIN_MASS_EXPONENT, MAX_MASS_EXPONENT)
    );
    const earthMasses: number = 10 ** this.massExponent();
    this.mass.set(earthMasses);
    this.massChange.emit(earthMasses * EARTH_MASS);
    // both discs and the reach of the target's gravity have just changed
    this.setOrbitDistance(this.orbit());
  }

  /** Sets how fast the target travels. */
  setSpeed(speed: number): void {
    const clamped: number = clamp(speed, 0, MAX_SPEED);
    this.speed.set(clamped);
    this.speedChange.emit(clamped);
  }

  /** Moves the target itself to `distance` from its own primary. */
  setDistance(distance: number): void {
    if (!this.primary()) {
      return;
    }
    const { min, max } = this.distanceRange();
    const clamped: number = clamp(distance, min, max);
    this.distance.set(clamped);
    this.distanceChange.emit(clamped);
  }

  /** Sets how far from the target its next satellite will be placed. */
  setOrbitDistance(distance: number): void {
    const { min, max } = this.orbitRange();
    this.orbit.set(clamp(distance, min, max));
  }

  /** Asks for a satellite on the orbit the slider is set to. */
  placeSatellite(): void {
    this.addSatellite.emit(this.orbit());
  }

  /** Asks for the target to be taken out of the world. */
  removeTarget(): void {
    this.remove.emit();
  }

  close(): void {
    this.closed.emit();
  }

  /** Fills every slider from the body the panel has just been handed. */
  private readFrom(target: WorldObject): void {
    const earthMasses: number = target.mass / EARTH_MASS;
    this.mass.set(earthMasses);
    this.massExponent.set(
      clamp(
        earthMasses > 0 ? Math.log10(earthMasses) : MIN_MASS_EXPONENT,
        MIN_MASS_EXPONENT,
        MAX_MASS_EXPONENT
      )
    );
    this.speed.set(target.vel.length());
    const primary: WorldObject | undefined = primaryOf(target, this.sun());
    this.orbit.set(
      clamp(
        defaultOrbitDistance(target, primary, satelliteRadiusFor(target)),
        this.orbitRange().min,
        this.orbitRange().max
      )
    );
    this.distance.set(
      primary
        ? clamp(
            target.pos.dist(primary.pos),
            this.distanceRange().min,
            this.distanceRange().max
          )
        : 0
    );
  }

  /** Reads back what the world has moved on: how fast, and how far out. */
  private followTarget(): void {
    const target: WorldObject = this.target();
    const primary: WorldObject | undefined = this.primary();
    this.speed.set(target.vel.length());
    this.distance.set(primary ? target.pos.dist(primary.pos) : 0);
  }
}

/** A hundredth of the range, and never nothing: a slider needs a step. */
function stepFor({ min, max }: { min: number; max: number }): number {
  return Math.max((max - min) / 100, MIN_SLIDER_STEP);
}
