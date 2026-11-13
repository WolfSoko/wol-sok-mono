import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import type { LeagueId, Team } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { leagueTeamsResource } from '../basketball-data/league-teams-resource';
import { selectionChange } from '../errors/selection-change';
import { errorText, NO_LEAGUE } from '../errors/error-text';
import { FocusAfterUnfollowDirective } from '../team/focus-after-unfollow.directive';
import { AfterUnfollow } from '../team/after-unfollow';
import { FollowTeamComponent } from '../team/follow-team.component';

/**
 * Every Team of a Liga, by name as the DBB writes it (with the Verein's
 * team number, "TSV X 2"). One tap adds the Team to Meine Teams and opens
 * its page; disabled until Meine Teams are read and while a tap is
 * following one. A Team followed already says so ("Gefolgt"), opens on a
 * tap and has "Nicht mehr folgen" beside its row (`korb-follow-team`,
 * outside the row's button, since a button holds no other), which goes
 * once tapped: focus moves to the Team's row, and the snackbar offers to
 * undo it (`AfterUnfollow`).
 */
@Component({
  selector: 'korb-league-teams',
  imports: [
    FocusAfterUnfollowDirective,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    FollowTeamComponent,
  ],
  template: `
    @if (teams.isLoading()) {
      <mat-progress-bar
        mode="indeterminate"
        aria-label="Teams werden geladen"
      />
    }
    @if (error(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
    @if (teams.hasValue()) {
      @if (teams.value().length === 0) {
        <p>In dieser Liga stehen noch keine Teams fest.</p>
      } @else {
        <mat-action-list class="umbrechende-liste">
          @for (team of teams.value(); track team.id) {
            @let gefolgt = followedTeamIds().has(team.id);
            <div class="row">
              <button
                mat-list-item
                type="button"
                data-qa="team"
                [korbFocusAfterUnfollow]="team.id"
                [disabled]="followedTeams() === undefined || following()"
                (click)="followAndOpen(team)"
              >
                <mat-icon matListItemIcon aria-hidden="true">{{
                  gefolgt ? 'check' : 'add'
                }}</mat-icon>
                <span matListItemTitle>{{ team.name }}</span>
                @if (gefolgt) {
                  <span matListItemLine>Gefolgt</span>
                }
              </button>
              @if (gefolgt) {
                <korb-follow-team
                  [teamId]="team.id"
                  [teamName]="team.name"
                  [followed]="gefolgt"
                  disappearsOnUnfollow
                />
              }
            </div>
          }
        </mat-action-list>
      }
    }
    @if (change.error(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
  `,
  providers: [AfterUnfollow],
  styles: `
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 0.5rem;
    }
    .row > button {
      flex: 1 1 12rem;
      width: auto;
    }
    korb-follow-team {
      padding-inline: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueTeamsComponent {
  /** The Liga to list the Teams of. */
  public readonly leagueId = input.required<LeagueId>();

  private readonly selection = inject(AUSWAHL);
  private readonly router = inject(Router);

  protected readonly followedTeams = this.selection.teams;
  /** Meine Teams as a set, for each row to ask once. */
  protected readonly followedTeamIds = computed(
    () => new Set(this.followedTeams() ?? [])
  );
  protected readonly teams = leagueTeamsResource(() => this.leagueId());
  protected readonly change = selectionChange();
  /** Whether a tap is following a Team and opening it: no second one. */
  protected readonly following = signal(false);
  protected readonly error = computed(() =>
    errorText(this.teams.error(), NO_LEAGUE)
  );

  protected async followAndOpen(team: Team): Promise<void> {
    if (this.following()) {
      return;
    }
    this.following.set(true);
    try {
      if (await this.change.run(() => this.selection.follow(team.id))) {
        await this.router.navigate(['/team', team.id]);
      }
    } finally {
      this.following.set(false);
    }
  }
}
