import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { NextGameComponent } from '../game/next-game.component';
import { GameLinkComponent } from '../game/game-link.component';
import { AsOfComponent } from '../as-of/as-of.component';
import { FollowTeamComponent } from '../team/follow-team.component';
import { vereinsfarbenAnwenden } from '../vereinsfarben/vereinsfarben-anwenden';
import { VereinsfarbenKnopfComponent } from '../vereinsfarben/vereinsfarben-knopf.component';
import { SeasonOverHintComponent } from '../club/season-over-hint.component';
import { kartenName, type TeamKarte } from './team-karte';

/**
 * One of Meine Teams on the overview, as `karte` gives it: its next Spiel
 * with its Halle, what falls through before it and its last result, each
 * opening its Spiel page, and once its Saison looks over a hint with its
 * Verein's current Teams to follow; or why its read failed. Every card
 * ends with "Nicht mehr folgen", which takes the card away and offers to
 * undo it (`AfterUnfollow`, the overview's), beside "Vereinsfarben"; the
 * card wears its Verein's colours. Reads no data itself:
 * `MeineTeamsUeberblick` holds every card's reads, the next Spiel's Halle
 * and the Verein's Teams included.
 */
@Component({
  selector: 'korb-ueberblick-team',
  imports: [
    MatCardModule,
    MatProgressBarModule,
    NextGameComponent,
    RouterLink,
    SeasonOverHintComponent,
    GameLinkComponent,
    AsOfComponent,
    FollowTeamComponent,
    VereinsfarbenKnopfComponent,
  ],
  templateUrl: './ueberblick-team.component.html',
  styleUrl: './ueberblick-team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickTeamComponent {
  public readonly karte = input.required<TeamKarte>();

  /** The Team's name, or its id while its read has not given one. */
  protected readonly name = computed(() => kartenName(this.karte()));

  /** The Team's Verein, once its Saison is read. */
  protected readonly verein = computed(() => {
    const karte = this.karte();
    return karte.art === 'geladen' ? karte.verein : undefined;
  });

  public constructor() {
    vereinsfarbenAnwenden(() => this.verein()?.id);
  }
}
