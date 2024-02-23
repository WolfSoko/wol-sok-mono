import { Injectable, Signal, signal } from '@angular/core';
import { convertBlobToRawAudioData } from './convert-blob-to-raw-audio-data';

export type AudioRecordingState =
  | RecordingStateRecorded
  | RecordingStateRecording
  | RecordingStateInitial
  | RecordingStateError;

type AudioData = {
  audioData: ArrayLike<number>;
  samplesPerSec: number;
  lengthInMs: number;
};
export type RecordingStateRecorded = {
  state: 'recorded';
  data: AudioData;
};

export type RecordingStateRecording = {
  state: 'recording';
};

export type RecordingStateInitial = {
  state: 'ready';
};

export type RecordingStateError = {
  state: 'error';
  error: any;
};

const initialValue: AudioRecordingState = {
  state: 'ready',
};

const noop = () => {
  // noop
};

@Injectable({
  providedIn: 'root',
})
export class AudioRecorderService {
  private readonly _audioRecorderState = signal(initialValue);
  get audioRecorderState(): Signal<AudioRecordingState> {
    return this._audioRecorderState.asReadonly();
  }

  stopRecording: () => void = noop;
  recordAudio(): void {
    this._audioRecorderState.set({ state: 'recording' });

    const sampleRate = 44100;
    const options: MediaRecorderOptions = {
      audioBitsPerSecond: sampleRate,
    };
    let mediaRecorder: MediaRecorder;

    const handleSuccess = (stream: MediaStream) => {
      mediaRecorder = new MediaRecorder(stream, options);
      let recordedChunksPromise: Promise<Float32Array>;
      let data: AudioData;

      mediaRecorder.addEventListener('error', (e) => {
        console.error('MediaRecorder error:', e);
        this._audioRecorderState.set({ state: 'error', error: e });
        this.stopRecording = noop;
      });

      mediaRecorder.addEventListener('dataavailable', async (e) => {
        if (e.data.size > 0) {
          recordedChunksPromise = convertBlobToRawAudioData(e.data, sampleRate);
        }
      });

      mediaRecorder.addEventListener('stop', async () => {
        // combine recorded chunks into one Float32Array
        data = await this.convertRecordedChunkToAudioData(
          recordedChunksPromise,
          sampleRate
        );
        this._audioRecorderState.set({ state: 'recorded', data });
      });

      mediaRecorder.start();
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(handleSuccess, (e) => {
        this._audioRecorderState.set({ state: 'error', error: e });
      });

    this.stopRecording = () => mediaRecorder.stop();
  }
  private async convertRecordedChunkToAudioData(
    recordedChunksPromise: Promise<Float32Array>,
    sampleRate: number
  ): Promise<AudioData> {
    const recordedChunks = await recordedChunksPromise;

    const length = recordedChunks.length;
    const audioData = new Float32Array(length);
    audioData.set(recordedChunks);

    // create a new InputWave
    const len = audioData.length;
    const lengthInMs = (len / sampleRate) * 1000;
    return {
      samplesPerSec: sampleRate,
      lengthInMs,
      audioData: Array.from(audioData),
    };
  }
}
