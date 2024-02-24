import { InputWave } from '../input-wave.model';

export function replayWave(wave: InputWave): void {
  if (wave != null) {
    const context = new AudioContext();
    playByteArray(wave.points, wave.samplesPerSec, context);
  }
}

function playByteArray(
  bytes: ArrayLike<number>,
  sampleRate: number,
  context: AudioContext,
  kAmplitute = 1.0
) {
  const buffer = context.createBuffer(1, bytes.length, sampleRate);
  const buf = buffer.getChannelData(0);
  for (let i = 0; i < bytes.length; ++i) {
    buf[i] = bytes[i] * kAmplitute;
  }
  const node = context.createBufferSource();
  node.buffer = buffer;
  node.connect(context.destination);
  node.start();
}
