import {
  effect,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import {
  simpleStateChange,
  TrainingStateChange,
} from './model/log-events/state.change.model';
import { RepositoryFactory } from './repository/repository.factory';
import { TrainingRunnerService } from './training-runner/training-runner.service';

type TrainingEventLogEntry = [time: Date, event: TrainingStateChange];
type TrainingEventLog = TrainingEventLogEntry[];

@Injectable({ providedIn: 'root' })
export class TrainingEventLogService {
  private readonly logRepository =
    inject(RepositoryFactory).create<TrainingEventLog>('trainingEventLog');

  private readonly runnerService = inject(TrainingRunnerService);

  private readonly trainingEventLog: WritableSignal<TrainingEventLog>;

  constructor() {
    this.trainingEventLog = signal(this.logRepository.load() ?? []);

    effect(() => {
      console.log('TrainingEventLogService effect');
      const state = this.runnerService.trainingState();
      switch (state) {
        case 'paused':
          this.pauseTraining();
          break;
        case 'running':
          this.startTraining();
          break;
        case 'stopped':
          this.stopTraining();
          break;
      }
    });

    effect(() => {
      console.log('save log');
      return this.logRepository.save(this.trainingEventLog());
    });
  }

  private startTraining(): void {
    this.pushEntry(simpleStateChange('startTraining'));
  }

  private stopTraining(): void {
    this.pushEntry(simpleStateChange('endTraining'));
  }

  private pauseTraining(): void {
    this.pushEntry(simpleStateChange('paused'));
  }

  pushEntry(event: TrainingStateChange): void {
    this.trainingEventLog.update((log) => [...log, [new Date(), event]]);
  }
}
