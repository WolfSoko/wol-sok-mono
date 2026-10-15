import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  selector: 'pace-sprint-training-overview',
  template: `
    @let conf = data();
    <mat-card appearance="filled" data-qa="training-overview">
      <mat-card-header>
        <mat-card-title>Übersicht</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <ul class="plan">
          <li>{{ conf.repetitions }} Wiederholungen</li>
          <li>
            <span class="dot sprint"></span
            >{{ conf.sprintTime | trainingTime }} - Sprint
          </li>
          <li>
            <span class="dot recovery"></span
            >{{ conf.recoveryTime | trainingTime }} - Gehen/Stehen
          </li>
        </ul>
        <p class="total">Gesamtzeit: {{ conf.totalTime | trainingTime }}</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .plan {
      display: flex;
      flex-flow: column;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .plan li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot.sprint {
      background: var(--mat-sys-tertiary);
    }
    .dot.recovery {
      background: var(--mat-sys-primary);
    }
    .total {
      margin: 12px 0 0;
      font: var(--mat-sys-title-large);
      font-weight: 600;
    }
  `,
  imports: [MatCardModule, TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintTrainingOverviewComponent {
  public readonly data = inject(SprintTrainingDataService).data;
}
