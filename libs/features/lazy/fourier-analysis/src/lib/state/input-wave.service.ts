import { effect, inject, Injectable, Signal } from '@angular/core';
import { delay, filter, map, tap } from 'rxjs/operators';
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

  constructor(
    private readonly inputWaveStore: InputWaveRepo,
    private readonly inputWaveOptionsRepo: InputWaveOptionsRepo
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
            this.setActive(wave);
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

  add(inputWave: InputWave) {
    this.inputWaveStore.add(inputWave);
  }

  update(id: number, inputWave: Partial<InputWave>) {
    this.inputWaveStore.updateWave(id, inputWave);
  }
  setActive(wave: InputWave) {
    this.inputWaveStore.addActiveWave(wave);
  }

  listenToWave() {
    const activeWave = this.inputWaveStore.activeWave();
    if (!activeWave) {
      console.error('No active wave to listen to');
      return;
    }
    replayWave(activeWave);
  }

  recordAudio(): void {
    this.audioRecorderService.recordAudio();
  }

  stopRecording(): void {
    this.audioRecorderService.stopRecording();
  }
}
