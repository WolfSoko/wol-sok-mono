import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { TrainingEventBacklogService } from '../event-backlog/training-event-backlog.service';
import { countdownStateChange } from '../model/log-events/state-change.model';
import { CountdownModel } from '../model/training/countdown.model';
import { IntervalCountdownService } from './interval-countdown.service';

@Injectable({
  providedIn: 'root',
})
export class IntervalCountdownEventBridge {
  constructor() {
    const eventLogService = inject(TrainingEventBacklogService);
    const countdown = inject(IntervalCountdownService).countdown;
    this.registerCountdownEventsEffect(countdown, eventLogService);
  }

  private registerCountdownEventsEffect(
    countdown: Signal<CountdownModel | null>,
    eventLogService: TrainingEventBacklogService
  ): void {
    const countdownForLogging = computed(() => countdown(), {
      equal: (a, b) => a?.countdownTo === b?.countdownTo,
    });
    effect(() => {
      const loggedCountdown = countdownForLogging();
      if (loggedCountdown == null) {
        eventLogService.pushEntry(countdownStateChange('countdownEnd'));
      } else {
        eventLogService.pushEntry(
          countdownStateChange('countdownStart', loggedCountdown)
        );
      }
    });
  }
}
