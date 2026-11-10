import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TeamFolgenComponent } from '../team/team-folgen.component';
import type { VereinsTeamsStand } from './vereins-teams-stand';

/**
 * A Verein's Teams as their read stands (`stand`): loading, why it
 * failed, or each Team with its Ligen, linking to its page, and a control
 * to follow it. Reads nothing itself; the screen holding the read passes
 * it.
 */
@Component({
  selector: 'korb-vereins-teams',
  imports: [MatProgressBarModule, RouterLink, TeamFolgenComponent],
  template: `
    @let vereinsTeams = stand();
    @switch (vereinsTeams.art) {
      @case ('laedt') {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="Teams des Vereins werden geladen"
        />
      }
      @case ('fehler') {
        <p class="fehler" data-qa="vereins-teams-fehler">
          {{ vereinsTeams.text }}
        </p>
      }
      @case ('gelesen') {
        @if (vereinsTeams.teams.length === 0) {
          <p data-qa="vereins-teams-leer">
            @if (weitere()) {
              Keine weiteren Teams des Vereins in den letzten Wochen.
            } @else {
              Keine Teams des Vereins in den letzten Wochen.
            }
          </p>
        } @else {
          <ul>
            @for (team of vereinsTeams.teams; track team.teamId) {
              <li data-qa="vereins-team">
                <span class="team">
                  <a
                    data-qa="vereins-team-name"
                    [routerLink]="['/team', team.teamId]"
                    >{{ team.name }}</a
                  >
                  <span class="ligen" data-qa="vereins-team-ligen">{{
                    team.ligen
                  }}</span>
                </span>
                <korb-team-folgen
                  [teamId]="team.teamId"
                  [teamName]="team.name"
                />
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
    .ligen {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VereinsTeamsComponent {
  public readonly stand = input.required<VereinsTeamsStand>();
  /** Whether the list leaves out a Team the screen shows (its "weitere" Teams). */
  public readonly weitere = input(true);
}
