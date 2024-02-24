import { InputWaveOptionsModel } from './input-wave-options.model';
import { createRecordedInputWave, RecordedInputWave } from './input-wave.model';

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
