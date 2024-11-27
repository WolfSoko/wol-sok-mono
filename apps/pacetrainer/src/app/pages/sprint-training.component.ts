import { animate, style, transition, trigger } from '@angular/animations';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ShowSprintTrainingComponent } from '../features/training-configuration/show-sprint-training.component';
import { SprintFormComponent } from '../features/training-configuration/sprint-training-form.component';
import { SprintTrainingRunnerService } from '../features/training-runner/sprint-training-runner.service';

@Component({
  standalone: true,
  selector: 'pacetrainer-sprint-training',
  template: ` <mat-card data-qa="sprint-training">
    <mat-card-header>Sprint Training</mat-card-header>
    <mat-card-content>
      <div class="configurator">
        @if (trainingState() === 'stopped') {
          <pacetrainer-sprint-form @myInsertRemoveTrigger />
        }
        <pacetrainer-show-sprint-training />
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
  ],
})
export class SprintTrainingComponent {
  private readonly sprintTrainingRunnerService = inject(
    SprintTrainingRunnerService
  );

  trainingState = this.sprintTrainingRunnerService.trainingState;

  toggleTraining(): void {
    this.sprintTrainingRunnerService.toggleTraining();
  }

  endTraining(): void {
    this.sprintTrainingRunnerService.endTraining();
  }
}
