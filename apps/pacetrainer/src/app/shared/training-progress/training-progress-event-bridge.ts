import { computed, effect, inject, Injectable } from '@angular/core';
import {
  countdownStateChange,
  intervalStateChange,
} from '../model/log-events/state-change.model';
import { TrainingEventLogService } from '../training-event-log.service';
import { TrainingProgressService } from './training-progress.service';

@Injectable({
  providedIn: 'root',
})
export class TrainingProgressEventBridge {
  private readonly progressService = inject(TrainingProgressService);
  private readonly eventLogService = inject(TrainingEventLogService);

  constructor() {
    this.registerCurrentIntervalEventsEffect();
    this.registerCountdownEventsEffect();
  }

  private registerCountdownEventsEffect(): void {
    const countdownForLogging = computed(
      () => this.progressService.countdown(),
      { equal: (a, b) => a?.countdownTo === b?.countdownTo }
    );
    effect(() => {
      const countdown = countdownForLogging();
      if (countdown == null) {
        this.eventLogService.pushEntry(countdownStateChange('countdownEnd'));
      } else {
        this.eventLogService.pushEntry(
          countdownStateChange('countdownStart', countdown)
        );
      }
    });
  }

  private registerCurrentIntervalEventsEffect(): void {
    const currentIntervalForLogging = computed(
      () => this.progressService.currentInterval(),
      { equal: (a, b) => a?.index === b?.index }
    );

    effect(() => {
      const currentInterval = currentIntervalForLogging();
      if (currentInterval == null) {
        return;
      }
      this.eventLogService.pushEntry(
        intervalStateChange(currentInterval.name, currentInterval)
      );
    });
  }
}
