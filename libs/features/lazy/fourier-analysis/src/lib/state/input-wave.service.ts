import { effect, inject, Injectable, Signal } from '@angular/core';
import { delay, filter, map } from 'rxjs/operators';
import { replayWave } from '../model/audio/replay.wave';
import { createRecordedFrequencyWave } from '../model/create-recorded-frequency.wave';
import {
  InputWaveOptionsModel,
  waveOptionsFromWave,
} from '../model/input-wave-options.model';
import {
  createFrequencyPoints,
  createGeneratedFrequencyWave,
  InputWave,
} from '../model/input-wave.model';
import {
  AudioRecorderService,
  AudioRecordingState,
} from '../util/audio-recorder.service';
import { InputWaveOptionsRepo } from './input-wave-options.repo';
import { InputWaveRepo } from './input-wave-repo';

@Injectable({ providedIn: 'root' })
export class InputWaveService {
  private readonly audioRecorderService: AudioRecorderService =
    inject(AudioRecorderService);
  private readonly audioRecorderState: Signal<AudioRecordingState> =
    this.audioRecorderService.audioRecorderState;

  private stopReplay: () => void = () => {
    // noop
  };

  constructor(
    private readonly inputWaveStore: InputWaveRepo,
    private readonly inputWaveOptionsRepo: InputWaveOptionsRepo
  ) {
    inputWaveOptionsRepo.state$
      .pipe(
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
        this.inputWaveStore.addActiveWave(wave);
      });

    effect(
      () => {
        const record = this.audioRecorderState();
        switch (record.state) {
          case 'recording':
            this.inputWaveStore.updateAudioRecordState({
              state: record.state,
            });
            break;
          case 'recorded': {
            const { audioData, lengthInMs, samplesPerSec } = record.data;
            this.inputWaveStore.updateAudioRecordState({
              state: record.state,
            });
            const wave: InputWave = createRecordedFrequencyWave(
              { samplesPerSec, lengthInMs },
              audioData
            );
            this.inputWaveStore.addActiveWave(wave);
            this.inputWaveOptionsRepo.update(waveOptionsFromWave(wave));
            break;
          }
          case 'ready':
            this.inputWaveStore.updateAudioRecordState({
              state: record.state,
            });
            break;
          case 'error':
            this.inputWaveStore.updateAudioRecordState({
              state: record.state,
              error: record.error,
            });
        }
      },
      { allowSignalWrites: true }
    );
  }
  listenToWave() {
    const activeWave = this.inputWaveStore.activeWave();
    if (!activeWave) {
      console.error('No active wave to listen to');
      return;
    }

    this.stopReplay = replayWave(activeWave);
  }

  recordAudio(): void {
    this.stopReplay();
    this.audioRecorderService.recordAudio();
  }

  stopRecording(): void {
    this.audioRecorderService.stopRecording();
  }
}
