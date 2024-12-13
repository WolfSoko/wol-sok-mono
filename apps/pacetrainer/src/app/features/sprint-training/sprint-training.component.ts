import { animate, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IntervalCountdownEventBridge } from '../../shared/interval-countdown/interval-countdown-event-bridge';
import { IntervalCountdownService } from '../../shared/interval-countdown/interval-countdown.service';
import { TrainingProgressEventBridge } from '../../shared/training-progress/training-progress-event-bridge';
import { TrainingProgressService } from '../../shared/training-progress/training-progress.service';
import { TrainingRunnerService } from '../../shared/training-runner/training-runner.service';
import { TrainingRunnerEventBridge } from '../../shared/training-runner/training-runner-event-bridge.service';
import { CountDownCircleComponent } from '../../shared/ui/count-down-circle/count-down-circle.component';
import { SprintFormComponent } from '../training-configuration/sprint-training-form.component';
import { SprintTrainingOverviewComponent } from '../training-configuration/sprint-training-overview.component';
import { TrainingLiveStateComponent } from '../training-live-state/training-live-state.component';

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
  private readonly sprintTrainingRunnerService = inject(TrainingRunnerService);
  private readonly trainingProgressService = inject(TrainingProgressService);
  countdown = inject(IntervalCountdownService).countdown;

  constructor() {
    // inject services for side effects
    inject(TrainingProgressEventBridge);
    inject(TrainingRunnerEventBridge);
    inject(IntervalCountdownEventBridge);
  }

  // inject to create the TrainingProgressEventBridge
  private readonly trainingProgressEventBridge = inject(
    TrainingProgressEventBridge
  );

  trainingState = this.sprintTrainingRunnerService.trainingState;
  currentInterval = this.trainingProgressService.currentInterval;

  toggleTraining(): void {
    this.sprintTrainingRunnerService.toggleTraining();
  }

  endTraining(): void {
    this.sprintTrainingRunnerService.endTraining();
  }
}
