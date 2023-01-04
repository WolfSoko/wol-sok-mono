import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { InputWave } from './input-wave.model';
import { InputWaveState, InputWaveStore } from './input-wave.store';

@Injectable({
  providedIn: 'root',
})
export class InputWaveQuery extends QueryEntity<InputWaveState, InputWave> {
  constructor(protected override store: InputWaveStore) {
    super(store);
  }
}
