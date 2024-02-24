import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { debounceTime, Observable } from 'rxjs';
import { InputWaveOptionsModel } from '../../model/input-wave-options.model';
import { InputWaveOptionsRepo } from '../../state/input-wave-options.repo';

interface WaveOptionsForm {
  samplesPerSec: FormControl<number>;
  lengthInMs: FormControl<number>;
  frequencies: FormArray<FormControl<number>>;
}

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
export class WaveOptionsComponent {
  waveOptions$: Observable<InputWaveOptionsModel>;
  form: FormGroup<WaveOptionsForm>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly inputWaveOptionsRepo: InputWaveOptionsRepo
  ) {
    this.waveOptions$ = this.inputWaveOptionsRepo.state$;
    this.form = this.initForm();

    effect(() => {
      const optionsModel = this.inputWaveOptionsRepo.state();
      const updateOptions = { emitEvent: false };

      if (optionsModel) {
        this.updateForm(optionsModel, updateOptions);
      }
    });

    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((formValue) => {
        this.inputWaveOptionsRepo.update(formValue);
      });
  }

  private updateForm(
    optionsModel: InputWaveOptionsModel,
    updateOptions: { emitEvent: boolean }
  ): void {
    const { frequencies, ...rest } = optionsModel;
    this.form.patchValue(rest, updateOptions);

    const frequenciesFormControls = frequencies.map((freq) =>
      this.fb.nonNullable.control(freq)
    );
    this.form.setControl(
      'frequencies',
      this.fb.array(frequenciesFormControls),
      updateOptions
    );

    if (optionsModel.type === 'generated') {
      this.form.enable(updateOptions);
    }
    if (optionsModel.type === 'recorded') {
      this.form.disable(updateOptions);
    }
  }

  get frequencies(): FormArray<FormControl<number>> {
    return this.form.controls.frequencies;
  }

  private initForm(): FormGroup<WaveOptionsForm> {
    return this.fb.group({
      frequencies: this.fb.nonNullable.array<FormControl<number>>([]),
      lengthInMs: this.fb.nonNullable.control<number>(2, [Validators.min(10)]),
      samplesPerSec: this.fb.nonNullable.control<number>(1000, [
        Validators.min(100),
      ]),
    });
  }

  addFrequency() {
    this.inputWaveOptionsRepo.addFrequency();
  }

  removeFrequency(i: number) {
    this.inputWaveOptionsRepo.removeFrequency(i);
  }

  generateDefaultWave(): void {
    this.inputWaveOptionsRepo.reset();
  }
}
