import {Injectable} from '@angular/core';
import {Query} from '@datorama/akita';
import {InputWaveOptionsState, InputWaveOptionsStore} from './input-wave-options.store';

@Injectable({ providedIn: 'root' })
export class InputWaveOptionsQuery extends Query<InputWaveOptionsState> {
  constructor(protected override store: InputWaveOptionsStore) {
    super(store);
  }
}
