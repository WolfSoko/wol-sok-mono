import {
  computed,
  effect,
  inject,
  Injectable,
  Injector,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, interval, map, pairwise, takeUntil, tap } from 'rxjs';
import { SprintTrainingDataService } from '../../features/training-configuration/data/sprint-training-data.service';
import { SprintTrainingData } from '../../features/training-configuration/data/sprint-training.data';
import {
  add,
  Milliseconds,
  milliseconds,
  seconds,
  sToMs,
  subtract,
} from '../model/constants/time-utils';
import { CountdownModel } from '../model/training/countdown.model';
import { CurrentIntervalDataModel } from '../model/training/current-interval-data.model';
import { TrainingName } from '../model/training/training-name';
import { RepositoryFactory } from '../repository/repository.factory';
import { TrainingEventLogService } from '../training-event-log.service';
import { TrainingRunnerService } from '../training-runner/training-runner.service';

const PRECISION_PERIOD_MS = milliseconds(50);
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

  private injector = inject(Injector);

  private readonly progressRepo = inject(
    RepositoryFactory
  ).create<Milliseconds>('elapsedTrainingTime');

  private readonly runnerService = inject(TrainingRunnerService);

  private readonly eventLogService = inject(TrainingEventLogService);
  private readonly trainingProgressData = signal<TrainingData>([]);

  private readonly deltaTime$ = interval(PRECISION_PERIOD_MS).pipe(
    map(() => milliseconds(new Date().getTime())),
    pairwise(),
    map(([first, second]) => subtract(second, first))
  );

  elapsed = signal(this.progressRepo.load() ?? milliseconds(0));

  constructor() {
    effect(() => {
      console.log('Progress Service effect save elapsed');
      return this.progressRepo.save(this.elapsed());
    });

    effect(async () => {
      this.initProgressData(this.sprintTrainingDataService.data());
    });

    effect(() => {
      console.log('ProgressService effect2');
      const state = this.runnerService.trainingState();
      switch (state) {
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
    this.deltaTime$
      .pipe(
        tap((dT) => console.log('DT:' + dT)),
        filter(() => this.runnerService.trainingState() === 'running'),
        takeUntil(
          toObservable(this.runnerService.trainingState, {
            injector: this.injector,
          }).pipe(
            tap((state) => console.log('toObservable', state)),
            filter((state) => state !== 'running')
          )
        )
      )
      .subscribe((deltaT) => {
        console.log('Delta Time', deltaT);
        this.elapsed.update((old) => add(old, deltaT));
      });
  }

  private pauseTraining(): void {
    // to be implemented
  }
  private stopTraining(): void {
    this.elapsed.set(milliseconds(0));
  }

  currentInterval: Signal<null | CurrentIntervalDataModel> = computed(() => {
    const progressData = this.trainingProgressData();
    const sprintData = this.sprintTrainingDataService.data();
    const totalRepetitionCount = sprintData.repetitions;

    if (!progressData.length) {
      return null;
    }

    const elapsedTrainingTime = this.elapsed();
    const totalTrainingLength = this.trainingTotalLength();

    let accDuration = milliseconds(0);

    for (let i = 0; i < progressData.length; i++) {
      const [name, duration, repetitionCount] = progressData[i];
      const [nextName] = progressData[i + 1] ?? [];
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
          totalRepetitionCount,
          index: i,
          isLast: i === progressData.length - 1,
          leftTotalDuration: subtract(totalTrainingLength, elapsedTrainingTime),
          elapsedTrainingTime: elapsedTrainingTime,
          nextIntervalName: nextName,
          countdown: COUNTDOWN_TIME,
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
      totalRepetitionCount,
      index: progressData.length - 1,
      isLast: true,
      leftTotalDuration: milliseconds(0),
      elapsedTrainingTime: elapsedTrainingTime,
      nextIntervalName: 'finished',
      countdown: COUNTDOWN_TIME,
    };
  });

  countdown: Signal<CountdownModel | null> = computed(() => {
    const currentInterval = this.currentInterval();
    if (
      currentInterval == null ||
      currentInterval.leftDuration > currentInterval.countdown
    ) {
      return null;
    }
    return {
      countdownTime: currentInterval.leftDuration,
      countdownTo: currentInterval.nextIntervalName,
    };
  });
}
