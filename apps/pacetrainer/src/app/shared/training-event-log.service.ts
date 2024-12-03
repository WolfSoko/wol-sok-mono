import {
  effect,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import { SprintTrainingRunnerService } from '../features/training-runner/sprint-training-runner.service';
import { RepositoryFactory } from './repository/repository.factory';
import {
  simpleStateChange,
  TrainingStateChange,
} from './model/log-events/state.change.model';

type TrainingEventLogEntry = [time: Date, event: TrainingStateChange];
type TrainingEventLog = TrainingEventLogEntry[];

@Injectable({ providedIn: 'root' })
export class TrainingEventLogService {
  private readonly logRepository =
    inject(RepositoryFactory).create<TrainingEventLog>('trainingEventLog');

  private readonly runnerService = inject(SprintTrainingRunnerService);

  private trainingEventLog: WritableSignal<TrainingEventLog>;

  constructor() {
    this.trainingEventLog = signal(this.logRepository.load() ?? []);

    effect(
      () => {
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
      },
      { allowSignalWrites: true }
    );

    effect(() => this.logRepository.save(this.trainingEventLog()));
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
