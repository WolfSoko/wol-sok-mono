import { animate, style, transition, trigger } from '@angular/animations';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ShowSprintTrainingComponent } from '../features/training-configuration/show-sprint-training.component';
import { SprintFormComponent } from '../features/training-configuration/sprint-training-form.component';
import { SprintTrainingRunnerService } from '../features/training-runner/sprint-training-runner.service';
import { TrainingProgressService } from '../shared/training-progress.service';
import { CountDownCircleComponent } from '../shared/ui/count-down-circle/count-down-circle.component';
import { TrainingTimePipe } from '../shared/ui/training-time.pipe';

@Component({
  standalone: true,
  selector: 'pacetrainer-sprint-training',
  template: ` <mat-card data-qa="sprint-training">
    <mat-card-header>
      <mat-card-title>Sprint Training</mat-card-title>
      @if (currentInterval(); as current) {
        <mat-card-subtitle>
          <div>
            @switch (current.name) {
              @case ('sprint') {
                <span> Sprint </span>
              }
              @case ('recovery') {
                <span> Gehen </span>
              }
            }
            @if (trainingState() === 'paused') {
              <span>&nbsp;-&nbsp;pausiert</span>
            }
          </div>
          <div>
            Interval:&nbsp;{{ current.repetitionCount }}
            {{ current.elapsedDuration | trainingTime }}&nbsp;/&nbsp;
            {{ current.duration | trainingTime }}&nbsp;-&nbsp;Noch:
            {{ current.leftDuration | trainingTime }}
          </div>
        </mat-card-subtitle>
      }
    </mat-card-header>
    <mat-card-content>
      <div class="configurator">
        @if (trainingState() !== 'stopped'; as isStopped) {
          @if (currentInterval(); as interval) {
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
        @if (trainingState() === 'stopped') {
          @defer (on viewport) {
            <pacetrainer-sprint-form @myInsertRemoveTrigger />
          } @placeholder {
            <mat-spinner></mat-spinner>
          }
        }
        @defer (on viewport) {
          <pacetrainer-show-sprint-training />
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
        @switch (trainingState()) {
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
        [disabled]="trainingState() === 'stopped'"
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
    ShowSprintTrainingComponent,
    SprintFormComponent,
    MatButtonModule,
    CountDownCircleComponent,
    TrainingTimePipe,
    MatProgressSpinner,
  ],
})
export class SprintTrainingComponent {
  private readonly sprintTrainingRunnerService = inject(
    SprintTrainingRunnerService
  );

  trainingState = this.sprintTrainingRunnerService.trainingState;
  currentInterval = inject(TrainingProgressService).currentInterval;

  toggleTraining(): void {
    this.sprintTrainingRunnerService.toggleTraining();
  }

  endTraining(): void {
    this.sprintTrainingRunnerService.endTraining();
  }
}
