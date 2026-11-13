import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AFTER_FIRST_GAME_HINT } from '../child/child-hints';
import { FocusAfterUnfollowDirective } from '../team/focus-after-unfollow.directive';
import { AfterUnfollow } from '../team/after-unfollow';
import { FollowedTeamsOverview } from './followed-teams-overview';
import { OverviewChildComponent } from './overview-child.component';
import { OverviewTeamComponent } from './overview-team.component';

/**
 * The overview (`FollowedTeamsOverview`): each marked Kind with the Teams
 * it plays for, the one that plays first first, then the other Teams as
 * cards ("Weitere Teams"); while no Kind is marked, every Team's card and
 * how to mark one. Shows nothing until Meine Teams are read, then offers
 * to search a first Team while there is none, and a further one below
 * the cards once there are some; says so where they cannot be read at
 * all. A Team unfollowed from a card takes its control away, so focus
 * moves to the heading (`AfterUnfollow`).
 */
@Component({
  selector: 'korb-overview',
  imports: [
    FocusAfterUnfollowDirective,
    MatButtonModule,
    RouterLink,
    OverviewChildComponent,
    OverviewTeamComponent,
  ],
  providers: [FollowedTeamsOverview, AfterUnfollow],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewComponent {
  private readonly overview = inject(FollowedTeamsOverview);
  protected readonly afterFirstGameHint = AFTER_FIRST_GAME_HINT;
  protected readonly view = this.overview.view;
  protected readonly unreadable = this.overview.unreadable;
}
