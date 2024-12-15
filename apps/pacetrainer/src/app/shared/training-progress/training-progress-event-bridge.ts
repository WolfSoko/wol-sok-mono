import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { TrainingEventBacklogService } from '../event-backlog/training-event-backlog.service';
import { intervalStateChange } from '../model/log-events/state-change.model';
import { CurrentIntervalDataModel } from '../model/training/current-interval-data.model';
import { TrainingProgressService } from './training-progress.service';

@Injectable({
  providedIn: 'root',
})
export class TrainingProgressEventBridge {
  constructor() {
    const currentInterval = inject(TrainingProgressService).currentInterval;
    const eventLogService = inject(TrainingEventBacklogService);
    this.registerCurrentIntervalEventsEffect(currentInterval, eventLogService);
  }

  private registerCurrentIntervalEventsEffect(
    currentInterval: Signal<CurrentIntervalDataModel | null>,
    eventLogService: TrainingEventBacklogService
  ): void {
    const currentIntervalForLogging = computed(() => currentInterval(), {
      equal: (a, b) => a?.index === b?.index,
    });

    effect(() => {
      const currentInterval = currentIntervalForLogging();
      if (currentInterval == null) {
        return;
      }
      eventLogService.pushEntry(
        intervalStateChange(currentInterval.name, currentInterval)
      );
    });
  }
}
