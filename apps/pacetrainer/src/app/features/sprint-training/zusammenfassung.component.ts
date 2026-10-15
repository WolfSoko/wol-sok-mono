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
      <div class="pace-tiles">
        <div class="pace-tile">
          <span class="pace-tile-value">{{ s.elapsed | trainingTime }}</span>
          <span class="pace-tile-label">Gesamtzeit</span>
        </div>
        <div class="pace-tile">
          <span class="pace-tile-value"
            >{{ s.sprintsCompleted }} von {{ s.sprintsTotal }} Sprints</span
          >
          <span class="pace-tile-label">geschafft</span>
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
      background: var(--mat-sys-tertiary-container);
    }
    .headline {
      font: var(--mat-sys-headline-medium);
      font-weight: 700;
    }
  `,
  imports: [TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZusammenfassungComponent {
  public readonly zusammenfassung = input.required<Zusammenfassung>();
}
