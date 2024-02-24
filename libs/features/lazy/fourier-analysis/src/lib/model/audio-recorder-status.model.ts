export type RecorderStatus = 'recording' | 'recorded' | 'ready' | 'error';

export type RecorderState = RecorderStateError | NormalRecorderState;
export interface NormalRecorderState {
  state: 'recording' | 'recorded' | 'ready';
}

export interface RecorderStateError {
  error: any;
  state: 'error';
}

export const initialRecorderState: RecorderState = {
  state: 'ready',
};
