import {
  computed,
  effect,
  inject,
  Injectable,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { concat, defer, distinctUntilChanged, interval, map, of } from 'rxjs';
import { SprintTrainingDataService } from '../features/training-configuration/data/sprint-training-data.service';
import { SprintTrainingData } from '../features/training-configuration/data/sprint-training.data';
import { TrainingRunnerService } from './training-runner/training-runner.service';
import {
  add,
  Milliseconds,
  milliseconds,
  seconds,
  sToMs,
  subtract,
} from './model/constants/time-utils';
import { intervalStateChange } from './model/log-events/state.change.model';
import { CurrentIntervalDataModel } from './model/training/current-interval-data.model';
import { TrainingName } from './model/training/training-name';
import { RepositoryFactory } from './repository/repository.factory';
import { TrainingEventLogService } from './training-event-log.service';

const PRECISION_PERIOD_MS = milliseconds(100);
const COUNTDOWN_TIME = sToMs(seconds(5));

type TrainingInterval = [
  name: TrainingName,
  duration: Milliseconds,
  repetionCount: number,
  countdown?: Milliseconds,
];

type TrainingData = TrainingInterval[];

@Injectable({ providedIn: 'root' })
export class TrainingProgressService {
  private readonly sprintTrainingDataService = inject(
    SprintTrainingDataService
  );

  private readonly progressRepo = inject(
    RepositoryFactory
  ).create<Milliseconds>('ellapsedTrainingTime');

  private readonly runnerService = inject(TrainingRunnerService);

  private readonly eventLogService = inject(TrainingEventLogService);
  private readonly trainingProgressData = signal<TrainingData>([]);

  currentTime = toSignal(
    concat(
      defer(() => of(new Date())),
      interval(PRECISION_PERIOD_MS)
    ).pipe(map(() => new Date())),
    {
      requireSync: true,
    }
  );
  elapsed = signal(milliseconds(0));

  constructor() {
    this.initElapsedTiming();

    effect(
      () => {
        this.initProgressData(this.sprintTrainingDataService.data());
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const state = this.runnerService.trainingState();
        switch (state) {
          case 'paused':
            untracked(this.pauseTraining);
            break;
          case 'running':
            untracked(this.startTraining);
            break;
          case 'stopped':
            untracked(this.stopTraining);
            break;
        }
      },
      { allowSignalWrites: true }
    );
    this.registerLogCurrentIntervalEffect();
  }

  private initElapsedTiming(): void {
    this.elapsed = signal(this.progressRepo.load() ?? milliseconds(0));

    effect(
      () => {
        // every tick this function is called
        this.currentTime();
        const state = this.runnerService.trainingState();

        switch (state) {
          case 'paused':
            break;
          case 'stopped':
            this.elapsed.set(milliseconds(0));
            break;
          case 'running':
            this.elapsed.update((old) => add(old, PRECISION_PERIOD_MS));
            break;
        }
      },
      { allowSignalWrites: true }
    );

    effect(() => this.progressRepo.save(this.elapsed()));
  }

  private registerLogCurrentIntervalEffect(): void {
    const currentIntervalForLogging$ = toObservable(this.currentInterval).pipe(
      distinctUntilChanged(
        (previous, current) => previous?.index === current?.index
      )
    );
    const currentIntervalForLogging = toSignal(currentIntervalForLogging$);

    effect(
      () => {
        const currentInterval = currentIntervalForLogging();
        if (currentInterval == null) {
          return;
        }
        this.eventLogService.pushEntry(
          intervalStateChange(currentInterval.name, currentInterval)
        );
      },
      { allowSignalWrites: true }
    );
  }

  initProgressData(data: SprintTrainingData): void {
    const { repetitions, sprintTime, recoveryTime } = data;
    const progressData: TrainingData = [];

    for (let i = 0; i < repetitions; i++) {
      progressData.push(['sprint', sprintTime, i + 1, COUNTDOWN_TIME]);
      progressData.push(['recovery', recoveryTime, i + 1, COUNTDOWN_TIME]);
    }

    this.trainingProgressData.set(progressData);
  }

  trainingTotalLength = computed(() => {
    return this.trainingProgressData().reduce(
      (acc, [, duration]) => add(acc, duration),
      milliseconds(0)
    );
  });

  private startTraining(): void {
    // to be implemented
  }

  private pauseTraining(): void {
    // to be implemented
  }
  private stopTraining(): void {
    // to be implemented
  }

  currentInterval: Signal<null | CurrentIntervalDataModel> = computed(() => {
    const progressData = this.trainingProgressData();
    if (!progressData.length) {
      return null;
    }

    const elapsedTrainingTime = this.elapsed();
    const totalTrainingLength = this.trainingTotalLength();

    let accDuration = milliseconds(0);

    for (let i = 0; i < progressData.length; i++) {
      const [name, duration, repetitionCount] = progressData[i];
      accDuration = add(duration, accDuration);
      if (accDuration > elapsedTrainingTime) {
        const elapsedDuration = subtract(
          duration,
          subtract(accDuration, elapsedTrainingTime)
        );
        return {
          name,
          elapsedDuration,
          duration,
          leftDuration: subtract(duration, elapsedDuration),
          repetitionCount,
          index: i,
          isLast: i === progressData.length - 1,
          leftTotalDuration: subtract(totalTrainingLength, elapsedTrainingTime),
          elapsedTrainingTime: elapsedTrainingTime,
        };
      }
    }

    // already finished training
    const lastTrainingInterval = progressData.at(-1);
    if (!lastTrainingInterval) {
      throw new Error('Invalid training data');
    }
    const [lastName, lastDuration, repetitionCount] = lastTrainingInterval;

    return {
      name: lastName,
      duration: lastDuration,
      elapsedDuration: lastDuration,
      leftDuration: milliseconds(0),
      repetitionCount,
      index: progressData.length - 1,
      isLast: true,
      leftTotalDuration: milliseconds(0),
      elapsedTrainingTime: elapsedTrainingTime,
    };
  });
}
