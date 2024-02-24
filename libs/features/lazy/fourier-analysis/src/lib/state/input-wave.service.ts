import { effect, inject, Injectable, Signal } from '@angular/core';
import { applyTransaction, ID } from '@datorama/akita';
import { delay, filter, map, tap } from 'rxjs/operators';
import {
  InputWaveOptionsModel,
  waveOptionsFromWave,
} from '../model/input-wave-options.model';
import {
  createFrequencyPoints,
  createGeneratedFrequencyWave,
  createRecordedFrequencyWave,
  InputWave,
} from '../model/input-wave.model';
import {
  AudioRecorderService,
  AudioRecordingState,
} from '../util/audio-recorder.service';
import { InputWaveOptionsRepo } from './input-wave-options.repo';
import { InputWaveUIModel } from './input-wave-ui.model';
import { InputWaveQuery } from './input-wave.query';
import { InputWaveStore } from './input-wave.store';

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

@Injectable({ providedIn: 'root' })
export class InputWaveService {
  private readonly audioRecorderService: AudioRecorderService =
    inject(AudioRecorderService);
  private readonly audioRecorderState: Signal<AudioRecordingState> =
    this.audioRecorderService.audioRecorderState;

  constructor(
    private readonly inputWaveStore: InputWaveStore,
    private readonly inputWaveOptionsRepo: InputWaveOptionsRepo,
    private readonly inputWaveQuery: InputWaveQuery
  ) {
    inputWaveOptionsRepo.state$
      .pipe(
        tap(() => this.inputWaveStore.setLoading(true)),
        delay(1),
        filter(({ type }) => type === 'generated'),
        map((options: InputWaveOptionsModel) => {
          const points = createFrequencyPoints(
            options.frequencies,
            options.lengthInMs,
            options.samplesPerSec
          );
          return createGeneratedFrequencyWave(options, points);
        })
      )
      .subscribe((wave: InputWave) => {
        this.setActive(wave);
      });

    effect(
      () => {
        const record = this.audioRecorderState();
        switch (record.state) {
          case 'recording':
            this.updateAudioRecorderState({
              audioRecorderState: record.state,
            });
            break;
          case 'recorded': {
            const { audioData, lengthInMs, samplesPerSec } = record.data;
            this.updateAudioRecorderState({
              audioRecorderState: record.state,
            });
            const wave: InputWave = createRecordedFrequencyWave(
              { samplesPerSec, lengthInMs },
              audioData
            );
            this.setActive(wave);
            this.inputWaveOptionsRepo.update(waveOptionsFromWave(wave));
            break;
          }
          case 'ready':
            this.updateAudioRecorderState({
              audioRecorderState: record.state,
            });
            break;
          case 'error':
            this.updateAudioRecorderState({
              audioRecorderState: record.state,
              error: record.error,
            });
        }
      },
      { allowSignalWrites: true }
    );
  }

  add(inputWave: InputWave) {
    this.inputWaveStore.add(inputWave);
  }

  update(id: ID, inputWave: Partial<InputWave>) {
    this.inputWaveStore.update(id, inputWave);
  }

  updateAudioRecorderState(audioRecorderState: InputWaveUIModel) {
    this.inputWaveStore.update({ ui: audioRecorderState });
  }

  setActive(wave: InputWave) {
    applyTransaction(() => {
      this.inputWaveStore.add(wave);
      this.inputWaveStore.setActive(wave.id);
      this.inputWaveStore.remove((entity: InputWave) => entity.id !== wave.id);
      this.inputWaveStore.setLoading(false);
    });
  }

  remove(id: ID) {
    this.inputWaveStore.remove(id);
  }

  listenToWave() {
    const activeWave = this.inputWaveQuery.getActive();

    if (activeWave != null) {
      const context = new AudioContext();
      playByteArray(activeWave.points, activeWave.samplesPerSec, context);
    }
  }

  recordAudio(): void {
    this.audioRecorderService.recordAudio();
  }

  stopRecording(): void {
    this.audioRecorderService.stopRecording();
  }
}
