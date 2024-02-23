export type AudioRecorderState = 'recording' | 'recorded' | 'ready' | 'error';

export type InputWaveUIModel = RecorderState | RecorderStateError;

export interface RecorderState {
  audioRecorderState: 'recording' | 'recorded' | 'ready';
}

export interface RecorderStateError {
  error: any;
  audioRecorderState: 'error';
}
