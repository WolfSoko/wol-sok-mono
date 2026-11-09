import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { VereinsTeamsStand } from './vereins-teams-stand';
import { VereinsTeamsComponent } from './vereins-teams.component';

/**
 * The hint for a Team with no Spiel left and its last one more than two
 * weeks past (`saisonBeendet`): it asks whether the Saison is over, since
 * a long break looks the same, and offers the Verein's current Teams
 * (`stand`, once their read started) to follow for the next one.
 */
@Component({
  selector: 'korb-saison-ende-hinweis',
  imports: [VereinsTeamsComponent],
  template: `
    <p>
      <strong>Keine Spiele mehr angesetzt.</strong> Ist die Saison vorbei? Die
      aktuellen Teams des Vereins:
    </p>
    @if (stand(); as vereinsTeams) {
      <korb-vereins-teams data-qa="vereins-teams" [stand]="vereinsTeams" />
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
export class SaisonEndeHinweisComponent {
  public readonly stand = input<VereinsTeamsStand>();
}
