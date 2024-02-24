import { ID } from '@datorama/akita';
import { InputWaveOptionsModel } from './input-wave-options.model';

export type InputWave = GeneratedInputWave | RecordedInputWave;

export interface InputWaveProps {
  id: ID;
  points: ArrayLike<number>;
  samplesPerSec: number;
  lengthInMs: number;
}

export interface GeneratedInputWave extends InputWaveProps {
  type: 'generated';
  frequencies: number[];
}

export interface RecordedInputWave extends InputWaveProps {
  type: 'recorded';
}

let id = 0;

/**
 * A factory function that creates InputWave
 */
export function createGeneratedInputWave(
  params: Partial<GeneratedInputWave>
): GeneratedInputWave {
  return {
    id: id++,
    points: [],
    type: 'generated',
    ...params,
  } as GeneratedInputWave;
}

export function createRecordedInputWave(
  params: Partial<RecordedInputWave>
): RecordedInputWave {
  return {
    id: id++,
    points: [],
    type: 'recorded',
    ...params,
  } as RecordedInputWave;
}

export function createFrequencyPoints(
  frequencies: ArrayLike<number> = [220], // 220 Hz = "A" note
  lengthMs = 1000,
  samplesPerSec = 3000
): Array<number> {
  function* gen(): IterableIterator<number> {
    let step = 0;
    const samples = Math.floor((samplesPerSec * lengthMs) / 1000);
    while (step < samples) {
      const t = step / samplesPerSec;
      yield Array.from(frequencies).reduce(
        (previousFreq, currentFreq) =>
          previousFreq + Math.sin(currentFreq * 2 * Math.PI * t),
        0
      ) / frequencies.length;
      step++;
    }
  }

  return Array.from(gen());
}

export function createGeneratedFrequencyWave(
  { frequencies, samplesPerSec, lengthInMs }: InputWaveOptionsModel,
  points: number[]
): GeneratedInputWave {
  return createGeneratedInputWave({
    points,
    frequencies,
    lengthInMs,
    samplesPerSec: samplesPerSec,
  });
}

export function createRecordedFrequencyWave(
  {
    samplesPerSec,
    lengthInMs,
  }: Omit<InputWaveOptionsModel, 'frequencies' | 'type'>,
  points: ArrayLike<number>
): RecordedInputWave {
  return createRecordedInputWave({
    points,
    lengthInMs,
    samplesPerSec: samplesPerSec,
  });
}

export function isGeneratedWave(wave: InputWave): wave is GeneratedInputWave {
  return wave.type === 'generated';
}

export function isRecordedWave(wave: InputWave): wave is RecordedInputWave {
  return wave.type === 'recorded';
}
