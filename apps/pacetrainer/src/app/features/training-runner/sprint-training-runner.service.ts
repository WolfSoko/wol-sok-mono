import {
  effect,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import { RepositoryFactory } from '../../shared/repository/repository.factory';
import { TrainingRunnerState } from './training-runner.state';

@Injectable({ providedIn: 'root' })
export class SprintTrainingRunnerService {
  repo = inject(RepositoryFactory).create<TrainingRunnerState>(
    'trainingRunnerState'
  );
  trainingState: WritableSignal<TrainingRunnerState>;
  constructor() {
    this.trainingState = signal(this.repo.load() ?? 'stopped');
    effect(
      () => {
        this.repo.save(this.trainingState());
      },
      { allowSignalWrites: true }
    );
  }

  toggleTraining(): void {
    this.trainingState.update((value) =>
      value !== 'running' ? 'running' : 'paused'
    );
  }

  endTraining(): void {
    this.trainingState.set('stopped');
  }
}
