import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { TrainingEventBacklogService } from '../event-backlog/training-event-backlog.service';
import { intervalStateChange } from '../model/log-events/state-change.model';
import {
  getActiveExercise,
  TrainingProgress,
} from './model/training-progress.model';
import { TrainingProgressService } from './training-progress.service';

@Injectable({
  providedIn: 'root',
})
export class TrainingProgressEventBridge {
  constructor() {
    const currentInterval = inject(TrainingProgressService).trainingProgress;
    const eventLogService = inject(TrainingEventBacklogService);
    this.registerCurrentIntervalEventsEffect(currentInterval, eventLogService);
  }

  private registerCurrentIntervalEventsEffect(
    trainingProgress: Signal<TrainingProgress | null>,
    eventLogService: TrainingEventBacklogService
  ): void {
    const currentIntervalForLogging = computed(() => trainingProgress(), {
      equal: (a, b) => {
        if (a == null || b == null) {
          return a == b;
        }
        return (
          a.state === b.state &&
          a.activeExerciseIndex === b.activeExerciseIndex &&
          getActiveExercise(a)?.state === getActiveExercise(b)?.state
        );
      },
    });

    effect(() => {
      const currentTrainingProgress = currentIntervalForLogging();
      if (
        currentTrainingProgress == null ||
        getActiveExercise(currentTrainingProgress) == null
      ) {
        return;
      }
      eventLogService.pushEntry(
        intervalStateChange(
          getActiveExercise(currentTrainingProgress).exercise.type,
          currentTrainingProgress
        )
      );
    });
  }
}
