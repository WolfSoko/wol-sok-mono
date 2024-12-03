import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Seconds } from '../../../shared/model/constants/time-utils';
import { RepositoryFactory } from '../../../shared/repository/repository.factory';
import { SprintTrainingInputData } from './sprint-training-input.data';
import { SprintTrainingData } from './sprint-training.data';

@Injectable({
  providedIn: 'root',
})
export class SprintTrainingDataService {
  private readonly repositoryService = inject(
    RepositoryFactory
  ).create<SprintTrainingInputData>('sprint-training-data');

  // Define signals for the state
  repetitions = signal(4);
  sprintTime = signal(10 as Seconds);
  recoveryTime = signal(60 as Seconds);
  totalTime = computed(
    () =>
      (this.repetitions() *
        (this.sprintTime() + this.recoveryTime())) as Seconds
  );
  data = computed<SprintTrainingData>(() => ({
    repetitions: this.repetitions(),
    sprintTime: this.sprintTime(),
    recoveryTime: this.recoveryTime(),
    totalTime: this.totalTime(),
  }));

  constructor() {
    this.loadFromRepository();
    effect(() => this.saveToRepository(), { allowSignalWrites: true });
  }

  private saveToRepository(): void {
    const data: SprintTrainingInputData = {
      repetitions: this.repetitions(),
      sprintTime: this.sprintTime(),
      recoveryTime: this.recoveryTime(),
    };
    this.repositoryService.save(data);
  }

  private loadFromRepository(): void {
    const data = this.repositoryService.load();
    if (data) {
      this.repetitions.set(data.repetitions);
      this.sprintTime.set(data.sprintTime);
      this.recoveryTime.set(data.recoveryTime);
    }
  }

  updateState({
    repetitions,
    sprintTime,
    recoveryTime,
  }: Partial<SprintTrainingInputData>): void {
    if (repetitions) {
      this.repetitions.set(repetitions);
    }
    if (sprintTime) {
      this.sprintTime.set(sprintTime);
    }
    if (recoveryTime) {
      this.recoveryTime.set(recoveryTime);
    }
  }
}
