import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { InputWave } from './input-wave.model';

export interface InputWaveOptionsState {
  frequencies: number[];
  lengthInMs: number;
  samplesPerSec: number;
}

export function createInitialState(): InputWaveOptionsState {
  return {
    frequencies: [100, 200, 200, 300],
    lengthInMs: 1000,
    samplesPerSec: 5000,
  };
}

export function waveOptionsFromWave(wave: InputWave): InputWaveOptionsState {
  return {
    frequencies: wave.frequencies,
    lengthInMs: wave.lengthInMs,
    samplesPerSec: wave.samplesPerSec,
  };
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'input-wave-options' })
export class InputWaveOptionsStore extends Store<InputWaveOptionsState> {
  constructor() {
    super(createInitialState());
  }
}
