import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { FollowTeamComponent } from '../team/follow-team.component';
import { ClubTeamDetailDirective } from './club-team-detail.directive';
import type { ClubTeamsState } from './club-teams-state';

/**
 * A Verein's Teams as their read stands (`state`): loading, why it
 * failed, or each Team with its Ligen, linking to its page, and a control
 * to follow it, and what the screen's `korbClubTeamDetail` template adds
 * below each Team.
 * Reads nothing itself; the screen holding the read passes it.
 */
@Component({
  selector: 'korb-club-teams',
  imports: [
    MatProgressBarModule,
    NgTemplateOutlet,
    RouterLink,
    FollowTeamComponent,
  ],
  template: `
    @let vereinsTeams = state();
    @switch (vereinsTeams.kind) {
      @case ('loading') {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="Teams des Vereins werden geladen"
        />
      }
      @case ('error') {
        <p class="fehler" data-qa="vereins-teams-fehler">
          {{ vereinsTeams.text }}
        </p>
      }
      @case ('read') {
        @if (vereinsTeams.teams.length === 0) {
          <p>{{ emptyText() }}</p>
        } @else {
          <ul>
            @for (team of vereinsTeams.teams; track team.teamId) {
              <li data-qa="club-team">
                <span class="team">
                  <a
                    data-qa="club-team-name"
                    [routerLink]="['/team', team.teamId]"
                    >{{ team.name }}</a
                  >
                  <span class="leagues" data-qa="club-team-leagues">{{
                    team.leagues
                  }}</span>
                </span>
                <korb-follow-team
                  [teamId]="team.teamId"
                  [teamName]="team.name"
                />
                @if (teamDetail(); as detail) {
                  <ng-container
                    [ngTemplateOutlet]="detail.template"
                    [ngTemplateOutletContext]="{ $implicit: team }"
                  />
                }
              </li>
            }
          </ul>
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    p {
      margin: 0;
    }
    ul {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
    }
    .team {
      display: grid;
    }
    a {
      color: inherit;
    }
    .leagues {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubTeamsComponent {
  public readonly state = input.required<ClubTeamsState>();
  /** What it says where the Verein has no Team to list. */
  public readonly emptyText = input(
    'Keine weiteren Teams des Vereins in den letzten Wochen.'
  );
  /**
   * What the screen shows below each Team, given the Team's row: it takes
   * a line of its own where it sets `flex-basis: 100%`.
   */
  protected readonly teamDetail = contentChild(ClubTeamDetailDirective);
}
