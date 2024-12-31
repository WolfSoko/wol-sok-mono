import { animate, style, transition, trigger } from '@angular/animations';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { interval, map, take } from 'rxjs';
import { IntervalCountdownEventBridge } from '../../shared/interval-countdown/interval-countdown-event-bridge';
import { IntervalCountdownService } from '../../shared/interval-countdown/interval-countdown.service';
import { milliseconds } from '../../shared/model/constants/time-utils';
import {
  CurrentExerciseViewModel,
  mapFromTrainingProgress,
} from '../../shared/model/training/current-exercise-view.model';
import { TrainingProgressEventBridge } from '../../shared/training-progress/training-progress-event-bridge';
import { TrainingProgressService } from '../../shared/training-progress/training-progress.service';
import { TrainingRunnerEventBridge } from '../../shared/training-runner/training-runner-event-bridge.service';
import { TrainingRunnerService } from '../../shared/training-runner/training-runner.service';
import { CountDownCircleComponent } from '../../shared/ui/count-down-circle/count-down-circle.component';
import { SprintFormComponent } from '../training-configuration/sprint-training-form.component';
import { SprintTrainingOverviewComponent } from '../training-configuration/sprint-training-overview.component';
import { TrainingLiveStateComponent } from '../training-live-state/training-live-state.component';

const START_TRAINING_COUNTDOWN = milliseconds(5000);

@Component({
  selector: 'pacetrainer-sprint-training',
  templateUrl: './sprint-training.component.html',
  animations: [
    trigger('myInsertRemoveTrigger', [
      transition(':enter', [
        style({ opacity: 0, height: 0 }),
        animate('100ms ease-out', style({ opacity: 1, height: 100 })),
      ]),
      transition(':leave', [
        style({ opacity: 1, height: 100 }),
        animate('100ms ease-in', style({ opacity: 0, height: 0 })),
      ]),
    ]),
  ],
  styleUrl: './sprint-training.component.scss',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    SprintTrainingOverviewComponent,
    SprintFormComponent,
    CountDownCircleComponent,
    TrainingLiveStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintTrainingComponent {
  private readonly destroyRef = inject(DestroyRef);

  private readonly sprintTrainingRunnerService = inject(TrainingRunnerService);
  private readonly trainingProgressService = inject(TrainingProgressService);
  private readonly countdownService = inject(IntervalCountdownService);
  readonly countdown = this.countdownService.countdown;
  readonly startingTraining = signal(false);

  trainingState = this.sprintTrainingRunnerService.trainingState;
  currentExercise = computed(() => {
    const training = this.trainingProgressService.trainingProgress();
    if (!training || training.state === 'clean') {
      return null;
    }
    const currentExerciseViewModel: null | CurrentExerciseViewModel =
      mapFromTrainingProgress(training);
    return currentExerciseViewModel;
  });

  constructor() {
    // inject services for side effects
    inject(TrainingProgressEventBridge);
    inject(TrainingRunnerEventBridge);
    inject(IntervalCountdownEventBridge);

    effect(() => {
      const currentExercise = this.currentExercise();
      if (!currentExercise) {
        return;
      }
      const { countdown, nextIntervalName } = currentExercise;
      const nextName = nextIntervalName ?? 'finished';
      if (currentExercise && countdown) {
        this.countdownService.updateCountdown(
          milliseconds(
            Math.min(
              START_TRAINING_COUNTDOWN,
              currentExercise.duration ?? START_TRAINING_COUNTDOWN
            )
          ),
          currentExercise.leftDuration,
          nextName
        );
      } else {
        this.countdownService.endCountdown();
      }
    });
  }

  toggleTraining(): void {
    if (['stopped', 'initial'].includes(this.trainingState())) {
      this.startingTraining.set(true);
      interval(50)
        .pipe(
          take(Math.floor(5000 / 50)),
          map((i) => milliseconds(i * 50)),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (time) => {
            this.countdownService.updateCountdown(
              START_TRAINING_COUNTDOWN,
              milliseconds(Math.max(START_TRAINING_COUNTDOWN - time, 0)),
              'getready'
            );
          },
          error: (e) =>
            console.error('Error when trying to start training: ', e),
          complete: () => {
            this.countdownService.endCountdown();
            this.startingTraining.set(false);
            this.sprintTrainingRunnerService.toggleTraining();
          },
        });
    } else {
      this.sprintTrainingRunnerService.toggleTraining();
    }
  }

  endTraining(): void {
    this.sprintTrainingRunnerService.endTraining();
  }
}
