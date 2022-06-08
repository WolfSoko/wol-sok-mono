import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { PersistNgFormPlugin } from '@datorama/akita';
import { Observable } from 'rxjs';
import { InputWaveOptionsQuery } from '../../state/input-wave-options.query';
import { InputWaveOptionsState } from '../../state/input-wave-options.store';

@Component({
  selector: 'lazy-feat-fanal-wave-options',
  templateUrl: './wave-options.component.html',
  styleUrls: ['./wave-options.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveOptionsComponent implements OnDestroy {
  private readonly persistForm: PersistNgFormPlugin;
  waveOptions$: Observable<InputWaveOptionsState>;
  form: UntypedFormGroup;

  constructor(
    private fb: UntypedFormBuilder,
    private inputWaveOptionsQuery: InputWaveOptionsQuery
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

  get frequencies(): UntypedFormArray {
    return this.form.get('frequencies') as UntypedFormArray;
  }

  private initFormValues(): UntypedFormGroup {
    return this.fb.group({
      frequencies: this.fb.array([]),
      lengthInMs: this.fb.control(null, [Validators.min(10)]),
      samplesPerSec: this.fb.control(null, [Validators.min(100)]),
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
