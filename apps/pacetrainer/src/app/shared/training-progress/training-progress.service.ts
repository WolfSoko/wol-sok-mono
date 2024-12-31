import {
  effect,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, interval, map, pairwise, takeUntil } from 'rxjs';
import { SprintTrainingDataService } from '../../features/training-configuration/data/sprint-training-data.service';
import {
  add,
  le,
  Milliseconds,
  milliseconds,
  subtract,
  ZERO_MS,
} from '../model/constants/time-utils';
import { RepositoryFactory } from '../repository/repository.factory';
import { TrainingRunnerService } from '../training-runner/training-runner.service';
import { isExerciseFinishedByTime } from './model/exercise-progress.model';
import {
  activateNextExercise,
  createTrainingProgress,
  finishTraining,
  getActiveExercise,
  progressElapsedTrainingTime,
  startTraining,
  TrainingProgress,
} from './model/training-progress.model';

const PRECISION_PERIOD_MS = milliseconds(50);

@Injectable({ providedIn: 'root' })
export class TrainingProgressService {
  private injector = inject(Injector);
  private readonly sprintTrainingDataService = inject(
    SprintTrainingDataService
  );

  private readonly elapsedTrainingTimeRepo = inject(
    RepositoryFactory
  ).create<Milliseconds>('elapsedTrainingTime');

  private readonly trainingProgressRepo =
    inject(RepositoryFactory).create<TrainingProgress>('trainingProgress');

  private readonly runnerService = inject(TrainingRunnerService);

  private readonly trainingProgressInternal = linkedSignal(() =>
    createTrainingProgress(
      this.sprintTrainingDataService.sprintTrainingConfig()
    )
  );

  private readonly deltaTime$ = interval(PRECISION_PERIOD_MS).pipe(
    map(() => milliseconds(new Date().getTime())),
    pairwise(),
    map(([first, second]) => subtract(second, first))
  );

  readonly trainingProgress = this.trainingProgressInternal.asReadonly();
  readonly elapsed = signal(
    this.elapsedTrainingTimeRepo.load() ?? milliseconds(0)
  );

  constructor() {
    effect(() => {
      this.elapsedTrainingTimeRepo.save(this.elapsed());
    });

    effect(() => {
      const state = this.runnerService.trainingState();
      switch (state) {
        case 'initial':
          break;
        case 'paused':
          untracked(() => this.pauseTraining());
          break;
        case 'running':
          untracked(() => this.startTraining());
          break;
        case 'stopped':
          untracked(() => this.stopTraining());
          break;
      }
    });

    effect(() => {
      this.trainingProgressRepo.save(this.trainingProgress());
    });

    effect(() => {
      const trainingProgress = untracked(() => this.trainingProgressInternal());
      const elapsedDuration = this.elapsed();
      if (trainingProgress == null) {
        return;
      }
      this.trainingProgressInternal.set(
        this.updateTrainingProgress(trainingProgress, elapsedDuration)
      );
    });
  }

  private startTraining(): void {
    this.deltaTime$
      .pipe(
        filter(() => this.runnerService.trainingState() === 'running'),
        takeUntil(
          toObservable(this.runnerService.trainingState, {
            injector: this.injector,
          }).pipe(filter((state) => state !== 'running'))
        )
      )
      .subscribe((deltaT) => {
        this.elapsed.update((old) => add(old, deltaT));
      });
  }

  private pauseTraining(): void {
    // to be implemented
  }

  private stopTraining(): void {
    this.trainingProgressInternal.update((training) =>
      finishTraining(training, this.elapsed())
    );
    this.elapsed.set(milliseconds(0));
  }

  private updateTrainingProgress(
    training: TrainingProgress,
    elapsedTrainingTime: Milliseconds
  ): TrainingProgress {
    switch (training.state) {
      case 'clean': {
        if (le(elapsedTrainingTime, ZERO_MS)) {
          return training;
        }
        return startTraining(training);
      }
      case 'started': {
        const updatedTraining: TrainingProgress = progressElapsedTrainingTime(
          training,
          elapsedTrainingTime
        );

        const isFinishedByTime = isExerciseFinishedByTime(
          getActiveExercise(training)
        );
        if (!isFinishedByTime) {
          return updatedTraining;
        }

        if (training.activeExerciseIndex >= training.exercises.length - 1) {
          return finishTraining(updatedTraining, elapsedTrainingTime);
        }

        return activateNextExercise(updatedTraining, elapsedTrainingTime);
      }

      case 'finished': {
        return progressElapsedTrainingTime(training, elapsedTrainingTime);
      }
    }
  }
}
