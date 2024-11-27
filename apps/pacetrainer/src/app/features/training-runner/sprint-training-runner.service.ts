import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SprintTrainingRunnerService {
  trainingState: WritableSignal<'running' | 'stopped' | 'paused'> =
    signal('stopped');

  toggleTraining(): void {
    this.trainingState.update((value) =>
      value !== 'running' ? 'running' : 'paused'
    );
  }

  endTraining(): void {
    this.trainingState.set('stopped');
  }
}
