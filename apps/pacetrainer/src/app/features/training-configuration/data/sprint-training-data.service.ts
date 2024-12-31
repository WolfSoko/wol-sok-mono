import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  add,
  milliseconds,
  Seconds,
  sToMs,
} from '../../../shared/model/constants/time-utils';
import {
  createRecoveryExercise,
  createSprintExercise,
} from '../../../shared/model/training/excercise';
import { createIntervalWithDuration } from '../../../shared/model/training/interval';
import {
  createTrainingWithDuration,
  TrainingConfigWithDuration,
} from '../../../shared/model/training/training-config-with.duration';
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
  sprintTime = signal(sToMs(10 as Seconds));
  recoveryTime = signal(sToMs(60 as Seconds));
  totalTime = computed(() =>
    milliseconds(
      this.repetitions() * add(this.sprintTime(), this.recoveryTime())
    )
  );
  data = computed<SprintTrainingData>(() => ({
    repetitions: this.repetitions(),
    sprintTime: this.sprintTime(),
    recoveryTime: this.recoveryTime(),
    totalTime: this.totalTime(),
  }));

  sprintTrainingConfig = computed(() =>
    this.initSprintTrainingConfig(this.data())
  );

  constructor() {
    this.loadFromRepository();
    effect(() => {
      console.log('Save data');
      this.saveToRepository();
    });
  }

  private initSprintTrainingConfig(
    data: SprintTrainingData
  ): TrainingConfigWithDuration {
    const { repetitions, sprintTime, recoveryTime } = data;
    const exercises = createIntervalWithDuration(
      repetitions,
      createSprintExercise(sprintTime),
      createRecoveryExercise(recoveryTime)
    );
    return createTrainingWithDuration([exercises]);
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
