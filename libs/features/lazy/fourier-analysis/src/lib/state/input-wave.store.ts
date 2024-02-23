import { Injectable } from '@angular/core';
import {
  ActiveState,
  EntityState,
  EntityStore,
  StoreConfig,
} from '@datorama/akita';
import { AudioRecorderState, InputWaveUIModel } from './input-wave-ui.model';
import { InputWave } from './input-wave.model';

export interface InputWaveState extends EntityState<InputWave>, ActiveState {
  ui: InputWaveUIModel;
}

const initialUIState: { ui: InputWaveUIModel } = {
  ui: { audioRecorderState: 'ready' },
};

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'input-wave' })
export class InputWaveStore extends EntityStore<InputWaveState, InputWave> {
  constructor() {
    super(initialUIState);
  }
}
