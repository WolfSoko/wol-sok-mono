import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { InputWaveUIModel } from './input-wave-ui.model';
import { InputWave } from './input-wave.model';
import { InputWaveState, InputWaveStore } from './input-wave.store';

@Injectable({
  providedIn: 'root',
})
export class InputWaveQuery extends QueryEntity<InputWaveState, InputWave> {
  constructor(protected override store: InputWaveStore) {
    super(store);
  }

  selectUI() {
    return this.select((state) => state.ui);
  }
}
