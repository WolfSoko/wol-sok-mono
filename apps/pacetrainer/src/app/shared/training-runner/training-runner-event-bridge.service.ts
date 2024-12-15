import { effect, inject, Injectable } from '@angular/core';
import {
  simpleStateChange,
  TrainingStateChange,
} from '../model/log-events/state-change.model';
import { TrainingEventBacklogService } from '../event-backlog/training-event-backlog.service';
import { TrainingRunnerService } from './training-runner.service';

@Injectable({ providedIn: 'root' })
export class TrainingRunnerEventBridge {
  private readonly runnerService = inject(TrainingRunnerService);
  private readonly trainingEventLog = inject(TrainingEventBacklogService);

  constructor() {
    effect(() => {
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
    this.trainingEventLog.pushEntry(event);
  }
}
