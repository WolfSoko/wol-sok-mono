import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  selector: 'pace-sprint-training-overview',
  template: `
    @let conf = data();
    <section class="overview" data-qa="training-overview">
      <h3 class="title">Übersicht</h3>
      <ul class="plan">
        <li>{{ conf.repetitions }} Wiederholungen</li>
        <li data-tone="sprint">
          <span class="dot"></span>{{ conf.sprintTime | trainingTime }} - Sprint
        </li>
        <li data-tone="recovery">
          <span class="dot"></span>{{ conf.recoveryTime | trainingTime }} -
          Gehen/Stehen
        </li>
      </ul>
      <p class="total">Gesamtzeit: {{ conf.totalTime | trainingTime }}</p>
    </section>
  `,
  styles: `
    .overview {
      padding: 16px 20px;
      border-radius: var(--pace-radius-large);
      background: var(--mat-sys-surface-container);
    }
    .title {
      font: var(--mat-sys-title-medium);
      margin-bottom: 8px;
    }
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
      background: var(--pace-accent);
    }
    .total {
      margin: 12px 0 0;
      font: var(--mat-sys-title-large);
      font-weight: 600;
    }
  `,
  imports: [TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintTrainingOverviewComponent {
  public readonly data = inject(SprintTrainingDataService).data;
}
