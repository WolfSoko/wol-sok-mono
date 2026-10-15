import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Zusammenfassung } from '../../shared/training-run/training-run';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';

@Component({
  selector: 'pace-zusammenfassung',
  template: `
    @let s = zusammenfassung();
    <div class="zusammenfassung" data-qa="zusammenfassung">
      <span
        class="badge"
        aria-hidden="true"
        [class.complete]="s.completion === 'complete'"
      >
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
        <mat-card appearance="filled" class="pace-tile">
          <span class="pace-tile-value">{{ s.elapsed | trainingTime }}</span>
          <span class="pace-tile-label">Gesamtzeit</span>
        </mat-card>
        <mat-card appearance="filled" class="pace-tile">
          <span class="pace-tile-value"
            >{{ s.sprintsCompleted }} von {{ s.sprintsTotal }} Sprints</span
          >
          <span class="pace-tile-label">geschafft</span>
        </mat-card>
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
      width: 104px;
      height: 104px;
      border-radius: 50%;
      font-size: 44px;
      background: var(--mat-sys-surface-container-high);
      border: 4px solid var(--mat-sys-surface-container-highest);
    }
    .badge.complete {
      background: var(--pace-sprint-container);
      border-color: var(--pace-sprint);
    }
    .headline {
      font: var(--mat-sys-headline-medium);
      font-weight: 800;
      letter-spacing: -0.03em;
    }
  `,
  imports: [MatCardModule, TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZusammenfassungComponent {
  public readonly zusammenfassung = input.required<Zusammenfassung>();
}
