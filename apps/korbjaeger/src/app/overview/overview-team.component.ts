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
import { applyClubColors } from '../club-colors/apply-club-colors';
import { ClubColorsButtonComponent } from '../club-colors/club-colors-button.component';
import { SeasonOverHintComponent } from '../club/season-over-hint.component';
import { cardName, type TeamCard } from './team-card';

/**
 * One of Meine Teams on the overview, as `card` gives it: its next Spiel
 * with its Halle, what falls through before it and its last result, each
 * opening its Spiel page, and once its Saison looks over a hint with its
 * Verein's current Teams to follow; or why its read failed. Every card
 * ends with "Nicht mehr folgen", which takes the card away and offers to
 * undo it (`AfterUnfollow`, the overview's), beside "Vereinsfarben"; the
 * card wears its Verein's colours. Reads no data itself:
 * `FollowedTeamsOverview` holds every card's reads, the next Spiel's Halle
 * and the Verein's Teams included.
 */
@Component({
  selector: 'korb-overview-team',
  imports: [
    MatCardModule,
    MatProgressBarModule,
    NextGameComponent,
    RouterLink,
    SeasonOverHintComponent,
    GameLinkComponent,
    AsOfComponent,
    FollowTeamComponent,
    ClubColorsButtonComponent,
  ],
  templateUrl: './overview-team.component.html',
  styleUrl: './overview-team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewTeamComponent {
  public readonly card = input.required<TeamCard>();

  /** The Team's name, or its id while its read has not given one. */
  protected readonly name = computed(() => cardName(this.card()));

  /** The Team's Verein, once its Saison is read. */
  protected readonly club = computed(() => {
    const card = this.card();
    return card.kind === 'loaded' ? card.club : undefined;
  });

  public constructor() {
    applyClubColors(() => this.club()?.id);
  }
}
