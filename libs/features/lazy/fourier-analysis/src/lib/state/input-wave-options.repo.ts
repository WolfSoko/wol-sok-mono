import { Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { createStore, setProp, withProps } from '@ngneat/elf';
import { isEqual } from 'lodash';
import { distinctUntilChanged, Observable, shareReplay } from 'rxjs';
import {
  createInitialState,
  InputWaveOptionsModel,
} from '../model/input-wave-options.model';

const inputWaveOptionsStore = createStore(
  { name: 'inputWaveModelStore' },
  withProps<InputWaveOptionsModel>(createInitialState())
);

@Injectable({ providedIn: 'root' })
export class InputWaveOptionsRepo {
  state$: Observable<InputWaveOptionsModel> = inputWaveOptionsStore
    .asObservable()
    .pipe(
      distinctUntilChanged<InputWaveOptionsModel>(isEqual),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  state: Signal<InputWaveOptionsModel> = toSignal(this.state$, {
    requireSync: true,
  });

  update(inputWaveOptions: Partial<InputWaveOptionsModel>) {
    inputWaveOptionsStore.update((state) => ({
      ...state,
      ...inputWaveOptions,
      frequencies: inputWaveOptions.frequencies ?? state.frequencies,
    }));
  }

  addFrequency(frequency = 440): void {
    inputWaveOptionsStore.update(
      setProp('frequencies', (frequencies) => [...frequencies, frequency])
    );
  }

  removeFrequency(frequencyIndex: number): void {
    inputWaveOptionsStore.update(
      setProp('frequencies', (frequencies) => {
        if (frequencies.length > 1) {
          return frequencies.toSpliced(frequencyIndex, 1);
        }
        return frequencies;
      })
    );
  }

  reset(): void {
    inputWaveOptionsStore.reset();
  }
}
