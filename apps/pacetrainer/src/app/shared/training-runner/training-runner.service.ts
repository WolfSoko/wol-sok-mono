import { effect, inject, Injectable, signal } from '@angular/core';
import { RepositoryFactory } from '../repository/repository.factory';
import { TrainingRunnerState } from './training-runner.state';

@Injectable({ providedIn: 'root' })
export class TrainingRunnerService {
  repo = inject(RepositoryFactory).create<TrainingRunnerState>(
    'trainingRunnerState'
  );

  trainingState = signal(this.repo.load() ?? 'stopped');

  constructor() {
    effect(() => {
      console.log('save trainingState', this.trainingState());
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
