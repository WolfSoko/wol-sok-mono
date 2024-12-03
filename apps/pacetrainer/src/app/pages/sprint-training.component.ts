import { animate, style, transition, trigger } from '@angular/animations';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatList, MatListItem } from '@angular/material/list';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { SprintTrainingOverviewComponent } from '../features/training-configuration/sprint-training-overview.component';
import { SprintFormComponent } from '../features/training-configuration/sprint-training-form.component';
import { TrainingLiveStateComponent } from '../features/training-live-state/training-live-state.component';
import { TrainingRunnerService } from '../shared/training-runner/training-runner.service';
import { TrainingProgressService } from '../shared/training-progress.service';
import { CountDownCircleComponent } from '../shared/ui/count-down-circle/count-down-circle.component';
import { TrainingTimePipe } from '../shared/ui/training-time.pipe';

@Component({
  standalone: true,
  selector: 'pacetrainer-sprint-training',
  template: ` <mat-card data-qa="sprint-training">
    @let state = trainingState();
    @let interval = currentInterval();
    <mat-card-header>
      <mat-card-title>Sprint Training</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      <div class="configurator">
        @if (state !== 'stopped'; as isStopped) {
          @if (interval) {
            @defer (on viewport) {
              <pacetrainer-countdown-circle
                @myInsertRemoveTrigger
                [duration]="interval.duration"
                [timeLeft]="interval.leftDuration"
              />
            } @placeholder {
              <mat-spinner></mat-spinner>
            }
          }
        }
        @if (state === 'stopped') {
          @defer (on viewport) {
            <pacetrainer-sprint-form @myInsertRemoveTrigger />
          } @placeholder {
            <mat-spinner></mat-spinner>
          }
        }
        @defer (on viewport) {
          @if (interval) {
            <pacetrainer-training-live-state
              [currentInterval]="interval"
              [trainingState]="state"
            />
          }
          <pacetrainer-sprint-training-overview [open]="state === 'stopped'" />
        } @placeholder {
          <mat-spinner></mat-spinner>
        }
      </div>
    </mat-card-content>
    <mat-card-actions class="ctas">
      <button
        mat-raised-button
        (click)="toggleTraining()"
        data-qa="toggle-training"
      >
        @switch (state) {
          @case ('stopped') {
            Go Go Go
          }
          @case ('paused') {
            Weiter
          }
          @default {
            Pausieren
          }
        }
      </button>
      <button
        mat-raised-button
        [disabled]="state === 'stopped'"
        (click)="endTraining()"
        data-qa="stop-training"
      >
        Training beenden
      </button>
    </mat-card-actions>
  </mat-card>`,
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
  styles: `
    .ctas {
      justify-content: center;
      gap: 1rem;
    }
    .configurator {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
  `,
  imports: [
    MatCardModule,
    SprintTrainingOverviewComponent,
    SprintFormComponent,
    MatButtonModule,
    CountDownCircleComponent,
    TrainingTimePipe,
    MatProgressSpinner,
    MatList,
    MatListItem,
    TrainingLiveStateComponent,
  ],
})
export class SprintTrainingComponent {
  private readonly sprintTrainingRunnerService = inject(TrainingRunnerService);

  trainingState = this.sprintTrainingRunnerService.trainingState;
  currentInterval = inject(TrainingProgressService).currentInterval;

  toggleTraining(): void {
    this.sprintTrainingRunnerService.toggleTraining();
  }

  endTraining(): void {
    this.sprintTrainingRunnerService.endTraining();
  }
}
