import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { AUSWAHL } from '../auswahl/auswahl';
import { auswahlAenderung } from '../fehler/auswahl-aenderung';
import { NaechstesSpielComponent } from '../spiel/naechstes-spiel.component';
import { SpielLinkComponent } from '../spiel/spiel-link.component';
import { VereinsTeamsComponent } from '../verein/vereins-teams.component';
import type { TeamKarte } from './team-karte';

/**
 * One of Meine Teams on the overview, as `karte` gives it: its next Spiel
 * with its Halle, what falls through before it and its last result, each
 * opening its Spiel page, once its Saison is over a hint with its
 * Verein's current Teams to follow for the next one, or why its read failed, with "Entfernen" to
 * unfollow the Team. Reads no data itself: `MeineTeamsUeberblick` holds
 * every card's reads, the next Spiel's Halle included.
 */
@Component({
  selector: 'korb-ueberblick-team',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    NaechstesSpielComponent,
    RouterLink,
    SpielLinkComponent,
    VereinsTeamsComponent,
  ],
  templateUrl: './ueberblick-team.component.html',
  styleUrl: './ueberblick-team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickTeamComponent {
  public readonly karte = input.required<TeamKarte>();

  private readonly auswahl = inject(AUSWAHL);

  protected readonly aenderung = auswahlAenderung();

  protected entfernen(): Promise<void> {
    const teamId = this.karte().teamId;
    return this.aenderung.ausfuehren(() => this.auswahl.entfolgen(teamId));
  }
}
