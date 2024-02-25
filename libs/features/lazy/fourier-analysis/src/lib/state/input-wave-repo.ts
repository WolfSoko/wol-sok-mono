import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { createStore, propsFactory, withProps } from '@ngneat/elf';
import {
  addEntities,
  selectActiveEntity,
  setActiveId,
  updateEntities,
  withActiveId,
  withEntities,
} from '@ngneat/elf-entities';
import {
  initialRecorderState,
  RecorderState,
} from '../model/audio-recorder-status.model';
import { InputWave } from '../model/input-wave.model';

const {
  withAudioRecorderState,
  setAudioRecorderState,
  selectAudioRecorderState,
} = propsFactory('audioRecorderState', {
  initialValue: initialRecorderState,
  config: { sync: true },
});

const inputWavesStore = createStore(
  { name: 'InputWaves' },
  withProps<RecorderState>(initialRecorderState),
  withEntities<InputWave>(),
  withActiveId(),
  withAudioRecorderState()
);

@Injectable({ providedIn: 'root' })
export class InputWaveRepo {
  activeWave$ = inputWavesStore.pipe(selectActiveEntity());
  activeWave = toSignal(this.activeWave$);
  audioRecorderState = toSignal(
    inputWavesStore.pipe(selectAudioRecorderState()),
    { requireSync: true }
  );
  updateAudioRecordState(audioRecorderState: RecorderState): void {
    inputWavesStore.update(setAudioRecorderState(audioRecorderState));
  }

  add(inputWave: InputWave): void {
    inputWavesStore.update(addEntities([inputWave]));
  }

  updateWave(id: InputWave['id'], inputWave: Partial<InputWave>): void {
    inputWavesStore.update(updateEntities(id, inputWave));
  }

  addActiveWave(wave: InputWave) {
    inputWavesStore.update(addEntities(wave), setActiveId(wave.id));
  }
}
