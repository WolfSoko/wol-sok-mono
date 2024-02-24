import { InputWave, isGeneratedWave } from './input-wave.model';

export interface InputWaveOptionsModel {
  frequencies: number[];
  lengthInMs: number;
  samplesPerSec: number;
  type: 'generated' | 'recorded';
}

export function waveOptionsFromWave(wave: InputWave): InputWaveOptionsModel {
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

export function createInitialState(): InputWaveOptionsModel {
  return {
    frequencies: [100, 200, 200, 300],
    lengthInMs: 1000,
    samplesPerSec: 5000,
    type: 'generated',
  };
}
