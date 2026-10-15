import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  selector: 'pace-sprint-training-overview',
  template: `
    @let conf = data();
    <mat-card appearance="filled" class="overview" data-qa="training-overview">
      <mat-card-header>
        <mat-card-title>Übersicht</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <ul class="plan">
          <li>
            <span class="dot"></span>{{ conf.repetitions }} Wiederholungen
          </li>
          <li>
            <span class="dot sprint"></span
            >{{ conf.sprintTime | trainingTime }} Sprint
          </li>
          <li>
            <span class="dot recovery"></span
            >{{ conf.recoveryTime | trainingTime }} Gehen/Stehen
          </li>
        </ul>
        <p class="total">
          <span class="total-label">Gesamtzeit</span>
          <span class="total-value" data-qa="total-time">{{
            conf.totalTime | trainingTime
          }}</span>
        </p>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .overview {
      border: 1px solid var(--pace-hairline);
    }
    .plan {
      display: flex;
      flex-flow: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .plan li {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dot {
      width: 18px;
      height: 5px;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-outline-variant);
    }
    .dot.sprint {
      background: var(--pace-sprint);
    }
    .dot.recovery {
      background: var(--pace-recovery);
    }
    .total {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin: 14px 0 0;
      padding-top: 12px;
      border-top: 1px solid var(--pace-hairline);
    }
    .total-label {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .total-value {
      font: var(--mat-sys-headline-small);
      font-weight: 700;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
  `,
  imports: [MatCardModule, TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintTrainingOverviewComponent {
  public readonly data = inject(SprintTrainingDataService).data;
}
