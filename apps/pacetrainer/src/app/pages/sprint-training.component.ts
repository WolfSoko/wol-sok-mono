import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ShowSprintTrainingComponent } from '../features/training-configuration/show-sprint-training.component';
import { SprintFormComponent } from '../features/training-configuration/sprint-training-form.component';

@Component({
  standalone: true,
  selector: 'pacetrainer-sprint-training',
  template: ` <mat-card data-qa="sprint-training">
    <mat-card-header>Sprint Training</mat-card-header>
    <mat-card-content>
      <div class="configurator">
        <pacetrainer-sprint-form />
        <pacetrainer-show-sprint-training />
      </div>
    </mat-card-content>
  </mat-card>`,
  styles: `
    .configurator {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
  `,
  imports: [MatCardModule, ShowSprintTrainingComponent, SprintFormComponent],
})
export class SprintTrainingComponent {}
