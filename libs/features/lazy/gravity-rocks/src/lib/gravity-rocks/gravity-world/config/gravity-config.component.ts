import { CommonModule } from '@angular/common';
import { Component, Input, Output } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { distinctUntilChanged, map, Observable } from 'rxjs';
import {
  compareGravityWorldConfig,
  GravityWorldConfig,
} from '../domain/gravity-world-config';

@Component({
  selector: 'feat-lazy-gravity-config',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './gravity-config.component.html',
  styleUrls: ['./gravity-config.component.scss'],
})
export class GravityConfigComponent {
  readonly form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
  }>;

  @Input() set config(config: GravityWorldConfig) {
    this.form.patchValue(config);
  }

  @Output() readonly configChange: Observable<GravityWorldConfig>;

  constructor(nNfB: NonNullableFormBuilder) {
    this.form = nNfB.group({
      gravitationalConstant: 0,
      massOfSun: 0,
    });
    this.configChange = this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      distinctUntilChanged(compareGravityWorldConfig)
    );
  }
}
