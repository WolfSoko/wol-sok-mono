import { animate, style, transition, trigger } from '@angular/animations';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
