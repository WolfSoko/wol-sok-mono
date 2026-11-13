import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ClubTeamsState } from './club-teams-state';
import { ClubTeamsComponent } from './club-teams.component';

/**
 * The hint for a Team with no Spiel left and its last one more than two
 * weeks past (`seasonOver`): it asks whether the Saison is over, since
 * a long break looks the same, and offers the Verein's current Teams
 * (`state`, once their read started) to follow for the next one.
 */
@Component({
  selector: 'korb-season-over-hint',
  imports: [ClubTeamsComponent],
  template: `
    <p>
      <strong>Keine Spiele mehr angesetzt.</strong> Ist die Saison vorbei? Die
      aktuellen Teams des Vereins:
    </p>
    @if (state(); as vereinsTeams) {
      <korb-club-teams data-qa="vereins-teams" [state]="vereinsTeams" />
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    p {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonOverHintComponent {
  public readonly state = input<ClubTeamsState>();
}
