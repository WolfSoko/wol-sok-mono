import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { IntervalCountdownService } from '../../shared/interval-countdown/interval-countdown.service';
import { milliseconds } from '../../shared/model/constants/time-utils';
import { TrainingRun } from '../../shared/training-run/training-run';
import { CountDownCircleComponent } from '../../shared/ui/count-down-circle/count-down-circle.component';
import { ScreenWakeLockService } from '../../shared/wake-lock/screen-wake-lock.service';
import { SprintTrainingDataService } from '../training-configuration/data/sprint-training-data.service';
import { SprintFormComponent } from '../training-configuration/sprint-training-form.component';
import { SprintTrainingOverviewComponent } from '../training-configuration/sprint-training-overview.component';
import { TrainingLiveStateComponent } from '../training-live-state/training-live-state.component';
import { ZusammenfassungComponent } from './zusammenfassung.component';

/** Ansagen start at most this long before the next Intervall */
const ANSAGE_WINDOW = milliseconds(5000);

@Component({
  selector: 'pace-sprint-training',
  templateUrl: './sprint-training.component.html',
  styleUrl: './sprint-training.component.scss',
  imports: [
    MatButtonModule,
    SprintTrainingOverviewComponent,
    SprintFormComponent,
    CountDownCircleComponent,
    TrainingLiveStateComponent,
    ZusammenfassungComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintTrainingComponent {
  private readonly trainingRun = inject(TrainingRun);
  private readonly sprintTrainingData = inject(SprintTrainingDataService);
  private readonly countdownService = inject(IntervalCountdownService);

  protected readonly run = this.trainingRun.state;
  protected readonly countdown = this.countdownService.countdown;
  /** colors the screen after what the runner does right now */
  protected readonly tone = computed(() => {
    const run = this.run();
    if (run.phase === 'running' || run.phase === 'paused') {
      return run.current.name === 'sprint' ? 'sprint' : 'recovery';
    }
    return 'calm';
  });

  constructor() {
    inject(ScreenWakeLockService);

    // feeds the Ansagen with the time left until the next Intervall
    effect(() => {
      const run = this.run();
      switch (run.phase) {
        case 'leadIn':
          this.countdownService.updateCountdown(
            run.total,
            run.left,
            'getready'
          );
          break;
        case 'running':
        case 'paused':
          this.countdownService.updateCountdown(
            milliseconds(Math.min(ANSAGE_WINDOW, run.current.duration)),
            run.current.left,
            run.next
          );
          break;
        default:
          this.countdownService.endCountdown();
      }
    });
  }

  protected primaryAction(): void {
    // runs inside the click handler, so the browser allows audio afterwards
    this.countdownService.unlockAudio();
    switch (this.trainingRun.phase()) {
      case 'ready':
        this.trainingRun.start(this.sprintTrainingData.sprintTrainingConfig());
        break;
      case 'running':
      case 'paused':
        this.trainingRun.toggle();
        break;
      case 'finished':
        this.trainingRun.reset();
        break;
    }
  }

  protected endTraining(): void {
    this.trainingRun.end();
  }
}
