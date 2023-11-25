import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { PersistNgFormPlugin } from '@datorama/akita';
import { Observable } from 'rxjs';
import { InputWaveOptionsQuery } from '../../state/input-wave-options.query';
import { InputWaveOptionsState } from '../../state/input-wave-options.store';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSliderModule,
    MatButtonModule,
    MatIconModule,
  ],
  selector: 'lazy-feat-fanal-wave-options',
  templateUrl: './wave-options.component.html',
  styleUrls: ['./wave-options.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveOptionsComponent implements OnDestroy {
  private readonly persistForm: PersistNgFormPlugin;
  waveOptions$: Observable<InputWaveOptionsState>;
  form: FormGroup<{
    samplesPerSec: FormControl<number | null>;
    lengthInMs: FormControl<number | null>;
    frequencies: FormArray<FormControl<number | null>>;
  }>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly inputWaveOptionsQuery: InputWaveOptionsQuery
  ) {
    this.waveOptions$ = this.inputWaveOptionsQuery.select();
    this.form = this.initFormValues();
    this.persistForm = new PersistNgFormPlugin(
      this.inputWaveOptionsQuery,
      undefined,
      {
        debounceTime: 500,
      }
    ).setForm(this.form, this.fb);
  }

  get frequencies(): FormArray<FormControl<number | null>> {
    return this.form.controls.frequencies;
  }

  private initFormValues(): FormGroup<{
    samplesPerSec: FormControl<number | null>;
    lengthInMs: FormControl<number | null>;
    frequencies: FormArray<FormControl<number | null>>;
  }> {
    return this.fb.group({
      frequencies: this.fb.array<FormControl<number | null>>([]),
      lengthInMs: this.fb.control<number | null>(null, [Validators.min(10)]),
      samplesPerSec: this.fb.control<number | null>(null, [
        Validators.min(100),
      ]),
    });
  }

  ngOnDestroy(): void {
    if (this.persistForm != null) {
      this.persistForm.destroy();
    }
  }

  addFrequency() {
    this.frequencies.push(
      this.fb.control(this.frequencies.at(this.frequencies.length - 1).value)
    );
  }

  removeFrequency(i: number) {
    if (this.frequencies.length > 1) {
      this.frequencies.removeAt(i);
    }
  }
}
