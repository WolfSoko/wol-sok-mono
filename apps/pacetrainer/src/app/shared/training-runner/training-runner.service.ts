import {
  effect,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import { RepositoryFactory } from '../repository/repository.factory';
import { TrainingRunnerState } from './training-runner.state';

@Injectable({ providedIn: 'root' })
export class TrainingRunnerService {
  repo = inject(RepositoryFactory).create<TrainingRunnerState>(
    'trainingRunnerState'
  );
  trainingState: WritableSignal<TrainingRunnerState>;
  constructor() {
    this.trainingState = signal(this.repo.load() ?? 'stopped');
    effect(() => {
      this.repo.save(this.trainingState());
    });
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
