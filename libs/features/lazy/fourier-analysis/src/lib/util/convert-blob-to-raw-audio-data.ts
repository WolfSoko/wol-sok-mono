export async function convertBlobToRawAudioData(
  blob: Blob,
  sampleRate: number
): Promise<Float32Array> {
  const audioContext = new AudioContext({ sampleRate });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer: AudioBuffer =
    await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}
