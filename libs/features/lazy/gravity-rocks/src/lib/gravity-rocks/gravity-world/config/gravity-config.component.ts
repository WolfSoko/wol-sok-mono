import { CommonModule } from '@angular/common';
import { Component, Input, Output } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { distinctUntilChanged, map, Observable } from 'rxjs';
import { compareGravityWorldConfig, GravityWorldConfig } from '../domain/gravity-world-config';

@Component({
  selector: 'feat-lazy-gravity-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './gravity-config.component.html',
  styleUrls: ['./gravity-config.component.scss'],
})
export class GravityConfigComponent {
  readonly form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
  }> = this.nNfB.group({
    gravitationalConstant: 0,
    massOfSun: 0,
  });

  @Input() set config(config: GravityWorldConfig) {
    this.form.patchValue(config);
  }

  @Output() readonly configChange: Observable<GravityWorldConfig> = this.form.valueChanges.pipe(
    map(() => this.form.getRawValue()),
    distinctUntilChanged(compareGravityWorldConfig)
  );

  constructor(private nNfB: NonNullableFormBuilder) {}
}
