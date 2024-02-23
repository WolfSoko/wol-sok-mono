import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import {
  GeneratedInputWave,
  InputWave,
  isGeneratedWave,
} from './input-wave.model';

export interface InputWaveOptionsState {
  frequencies: ArrayLike<number>;
  lengthInMs: number;
  samplesPerSec: number;
  type: 'generated' | 'recorded';
}

export function createInitialState(): InputWaveOptionsState {
  return {
    frequencies: [100, 200, 200, 300],
    lengthInMs: 1000,
    samplesPerSec: 5000,
    type: 'generated',
  };
}

export function waveOptionsFromWave(wave: InputWave): InputWaveOptionsState {
  if (isGeneratedWave(wave)) {
    return {
      frequencies: wave.frequencies,
      lengthInMs: wave.lengthInMs,
      samplesPerSec: wave.samplesPerSec,
      type: wave.type,
    };
  }
  return {
    frequencies: [],
    lengthInMs: wave.lengthInMs,
    samplesPerSec: wave.samplesPerSec,
    type: wave.type,
  };
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'input-wave-options' })
export class InputWaveOptionsStore extends Store<InputWaveOptionsState> {
  constructor() {
    super(createInitialState());
  }
}
