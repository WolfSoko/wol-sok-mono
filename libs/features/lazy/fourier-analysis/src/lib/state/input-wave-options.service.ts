import { Injectable } from '@angular/core';
import { filterNotNil } from '@wolsok/utils-operators';
import {
  InputWaveOptionsStore,
  waveOptionsFromWave,
} from './input-wave-options.store';
import { InputWaveQuery } from './input-wave.query';

@Injectable({ providedIn: 'root' })
export class InputWaveOptionsService {
  constructor(
    private inputWaveOptionsStore: InputWaveOptionsStore,
    inputWaveQuery: InputWaveQuery
  ) {
    inputWaveQuery
      .selectActive()
      .pipe(filterNotNil)
      .subscribe((wave) =>
        this.inputWaveOptionsStore.update(waveOptionsFromWave(wave))
      );
  }
}
