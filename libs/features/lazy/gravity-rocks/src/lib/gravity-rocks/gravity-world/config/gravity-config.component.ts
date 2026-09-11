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
import { distinctUntilChanged, map, Observable } from 'rxjs';
import {
  compareGravityWorldConfig,
  GravityWorldConfig,
  MAX_TRAIL_LENGTH,
  MIN_TRAIL_LENGTH,
} from '../domain/gravity-world-config';

@Component({
  selector: 'feat-lazy-gravity-config',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatSlideToggleModule,
  ],
  templateUrl: './gravity-config.component.html',
  styleUrls: ['./gravity-config.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GravityConfigComponent {
  readonly minTrailLength = MIN_TRAIL_LENGTH;
  readonly maxTrailLength = MAX_TRAIL_LENGTH;

  readonly form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
    showTrail: FormControl<boolean>;
    trailLength: FormControl<number>;
  }>;

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
    });
    this.configChange = this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      distinctUntilChanged(compareGravityWorldConfig)
    );
  }
}
