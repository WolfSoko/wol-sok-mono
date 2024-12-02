import { Injectable, signal, WritableSignal } from '@angular/core';
import { TrainingRunnerState } from './training-runner.state';

@Injectable({ providedIn: 'root' })
export class SprintTrainingRunnerService {
  trainingState: WritableSignal<TrainingRunnerState> = signal('stopped');

  toggleTraining(): void {
    this.trainingState.update((value) =>
      value !== 'running' ? 'running' : 'paused'
    );
  }

  endTraining(): void {
    this.trainingState.set('stopped');
  }
}
