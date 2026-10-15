import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Zusammenfassung } from '../../shared/training-run/training-run';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';

@Component({
  selector: 'pace-zusammenfassung',
  template: `
    @let s = zusammenfassung();
    <div class="zusammenfassung" data-qa="zusammenfassung">
      <span class="badge" [class.complete]="s.completion === 'complete'">
        {{ s.completion === 'complete' ? '🏁' : '⏸' }}
      </span>
      <h3 class="headline">
        @if (s.completion === 'complete') {
          Training geschafft!
        } @else {
          Vorzeitig beendet
        }
      </h3>
      <div class="tiles">
        <div class="tile">
          <span class="value">{{ s.elapsed | trainingTime }}</span>
          <span class="label">Gesamtzeit</span>
        </div>
        <div class="tile">
          <span class="value"
            >{{ s.sprintsCompleted }} von {{ s.sprintsTotal }} Sprints</span
          >
          <span class="label">geschafft</span>
        </div>
      </div>
    </div>
  `,
  styles: `
    .zusammenfassung {
      display: flex;
      flex-flow: column;
      align-items: center;
      gap: 16px;
      width: 100%;
      text-align: center;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      font-size: 44px;
      background: var(--mat-sys-surface-container-high);
    }
    .badge.complete {
      background: var(--pace-sprint-container);
    }
    .headline {
      font: var(--mat-sys-headline-medium);
      font-weight: 700;
    }
    .tiles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
    }
    .tile {
      display: flex;
      flex-flow: column;
      gap: 4px;
      padding: 16px;
      border-radius: var(--pace-radius-medium);
      background: var(--mat-sys-surface-container);
    }
    .value {
      font: var(--mat-sys-title-large);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .label {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  imports: [TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZusammenfassungComponent {
  public readonly zusammenfassung = input.required<Zusammenfassung>();
}
