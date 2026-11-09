import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { NaechstesSpielComponent } from '../spiel/naechstes-spiel.component';
import { SpielLinkComponent } from '../spiel/spiel-link.component';
import { StandComponent } from '../stand/stand.component';
import { TeamFolgenComponent } from '../team/team-folgen.component';
import { SaisonEndeHinweisComponent } from '../verein/saison-ende-hinweis.component';
import { kartenName, type TeamKarte } from './team-karte';

/**
 * One of Meine Teams on the overview, as `karte` gives it: its next Spiel
 * with its Halle, what falls through before it and its last result, each
 * opening its Spiel page, and once its Saison looks over a hint with its
 * Verein's current Teams to follow; or why its read failed. Every card
 * ends with "Nicht mehr folgen", which takes the card away and offers to
 * undo it (`NACH_ENTFOLGEN`, the overview's). Reads no data itself:
 * `MeineTeamsUeberblick` holds every card's reads, the next Spiel's Halle
 * and the Verein's Teams included.
 */
@Component({
  selector: 'korb-ueberblick-team',
  imports: [
    MatCardModule,
    MatProgressBarModule,
    NaechstesSpielComponent,
    RouterLink,
    SaisonEndeHinweisComponent,
    SpielLinkComponent,
    StandComponent,
    TeamFolgenComponent,
  ],
  templateUrl: './ueberblick-team.component.html',
  styleUrl: './ueberblick-team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickTeamComponent {
  public readonly karte = input.required<TeamKarte>();

  /** The Team's name, or its id while its read has not given one. */
  protected readonly name = computed(() => kartenName(this.karte()));
}
