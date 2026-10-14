import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { Zusammenfassung } from '../../shared/training-run/training-run';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';

@Component({
  selector: 'pace-zusammenfassung',
  template: `
    @let s = zusammenfassung();
    <div class="zusammenfassung" data-qa="zusammenfassung">
      <span class="mat-title-large">
        @if (s.completion === 'complete') {
          Training geschafft!
        } @else {
          Vorzeitig beendet
        }
      </span>
      <mat-list>
        <mat-list-item
          >Gesamtzeit: {{ s.elapsed | trainingTime }}</mat-list-item
        >
        <mat-list-item
          >{{ s.sprintsCompleted }} von
          {{ s.sprintsTotal }} Sprints</mat-list-item
        >
      </mat-list>
    </div>
  `,
  styles: `
    .zusammenfassung {
      display: flex;
      flex-flow: column;
      align-items: center;
      padding: 1rem;
    }
  `,
  imports: [MatListModule, TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZusammenfassungComponent {
  public readonly zusammenfassung = input.required<Zusammenfassung>();
}
