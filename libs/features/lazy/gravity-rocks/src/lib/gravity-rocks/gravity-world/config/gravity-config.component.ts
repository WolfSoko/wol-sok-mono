import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DecimalPipe } from '@angular/common';
import { map } from 'rxjs';
import {
  compareGravityWorldConfig,
  GravityWorldConfig,
  INITIAL_SHOW_VELOCITY,
  INITIAL_SIMULATION_SPEED,
  MAX_SIMULATION_SPEED,
  MAX_TRAIL_LENGTH,
  MIN_SIMULATION_SPEED,
  MIN_TRAIL_LENGTH,
} from '../domain/gravity-world-config';
import { GRAVITATIONAL_CONSTANT } from '../domain/solar-system';

@Component({
  selector: 'feat-lazy-gravity-config',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatSlideToggleModule,
    DecimalPipe,
  ],
  templateUrl: './gravity-config.component.html',
  styleUrls: ['./gravity-config.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GravityConfigComponent {
  readonly minTrailLength = MIN_TRAIL_LENGTH;
  /** What gravity really is, so a changed one can be put back. */
  readonly realGravity = GRAVITATIONAL_CONSTANT;
  readonly maxTrailLength = MAX_TRAIL_LENGTH;
  /**
   * The speed slider runs on a log scale: the slow half of it would be a
   * sliver of a linear one, and a tenth of the speed is as big a step as ten
   * times of it.
   */
  readonly minSpeedExponent = Math.log10(MIN_SIMULATION_SPEED);
  readonly maxSpeedExponent = Math.log10(MAX_SIMULATION_SPEED);

  readonly form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
    showTrail: FormControl<boolean>;
    showVelocity: FormControl<boolean>;
    trailLength: FormControl<number>;
    simulationSpeed: FormControl<number>;
  }>;

  /** The speed that is set, or the normal one when the config carries none. */
  get simulationSpeed(): number {
    const speed: number = this.form.controls.simulationSpeed.value;
    // the world falls back the same way, so the label cannot show a speed the
    // simulation is not running at
    return speed > 0 ? speed : INITIAL_SIMULATION_SPEED;
  }

  /** Where the speed slider sits for the speed that is set. */
  get speedExponent(): number {
    return Math.log10(this.simulationSpeed);
  }

  /** Turns the slider position back into a speed, rounded to what it shows. */
  setSpeedExponent(exponent: number): void {
    this.form.controls.simulationSpeed.setValue(
      Math.round(10 ** exponent * 100) / 100
    );
  }

  /**
   * The settings the form shows, written back as the controls are used. A
   * two-way model rather than an input and an output of its own: what the
   * form holds and what the world runs on are the same thing.
   */
  readonly config = model.required<GravityWorldConfig>();

  constructor() {
    const nNfB = inject(NonNullableFormBuilder);

    this.form = nNfB.group({
      gravitationalConstant: 0,
      massOfSun: 0,
      showTrail: nNfB.control<boolean>(true),
      showVelocity: nNfB.control<boolean>(INITIAL_SHOW_VELOCITY),
      trailLength: MIN_TRAIL_LENGTH,
      simulationSpeed: INITIAL_SIMULATION_SPEED,
    });
    // the form follows the settings it is handed - silently, or patching it
    // would report the very value that was just given back as a change
    effect(() => {
      const config: GravityWorldConfig = this.config();
      if (!compareGravityWorldConfig(this.form.getRawValue(), config)) {
        this.form.patchValue(config, { emitEvent: false });
      }
    });
    this.form.valueChanges
      .pipe(
        map(() => this.form.getRawValue()),
        takeUntilDestroyed()
      )
      .subscribe((config: GravityWorldConfig) => {
        // a control set to what it already held is not a change, and a
        // settings object that is new only by identity restarts the world
        if (!compareGravityWorldConfig(this.config(), config)) {
          this.config.set(config);
        }
      });
  }
}
