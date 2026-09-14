import {
  Component,
  Input,
  Output,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { distinctUntilChanged, map, Observable } from 'rxjs';
import {
  compareGravityWorldConfig,
  GravityWorldConfig,
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

  @Input() set config(config: GravityWorldConfig) {
    this.form.patchValue(config);
  }

  @Output() readonly configChange: Observable<GravityWorldConfig>;

  constructor() {
    const nNfB = inject(NonNullableFormBuilder);

    this.form = nNfB.group({
      gravitationalConstant: 0,
      massOfSun: 0,
      showTrail: nNfB.control<boolean>(true),
      trailLength: MIN_TRAIL_LENGTH,
      simulationSpeed: INITIAL_SIMULATION_SPEED,
    });
    this.configChange = this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      distinctUntilChanged(compareGravityWorldConfig)
    );
  }
}
