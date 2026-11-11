import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { teamSaisonResource } from '../basketball-data/team-saison-resource';
import { fehlerText, KEIN_TEAM } from '../fehler/fehler-text';
import { HEUTE } from '../heute';
import { AFTER_FIRST_GAME_HINT } from '../kind/child-hints';
import { StandComponent } from '../stand/stand.component';
import { childStep } from './child-step';

/**
 * The next step of the search "Über mein Kind" for one of a Verein's
 * Teams, once it is followed: the link to its last played Spiel, whose
 * Kader offers to mark the Kind, or why there is none: no Spiel yet, or
 * none in a Liga the DBB keeps Spielberichte for. Shows nothing
 * for a Team not followed, and reads its Saison only once it is.
 */
@Component({
  selector: 'korb-child-step',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    StandComponent,
  ],
  template: `
    @if (followed()) {
      @if (saison.isLoading()) {
        <mat-progress-bar
          mode="indeterminate"
          [attr.aria-label]="'Spiele von ' + teamName() + ' werden geladen'"
        />
      } @else if (failure(); as text) {
        <p class="fehler" data-qa="child-step-failure">{{ text }}</p>
      } @else if (step(); as step) {
        <korb-stand data-qa="child-step-stand" [stand]="saison.stand()" />
        @switch (step.kind) {
          @case ('mark') {
            <a
              matButton="filled"
              data-qa="child-step-mark"
              [routerLink]="['/spiel', step.spielId]"
              [attr.aria-label]="'Kind im Kader markieren: ' + teamName()"
            >
              <mat-icon aria-hidden="true">star_outline</mat-icon>
              Kind im Kader markieren
            </a>
            <p>Im Kader seines letzten Spiels markierst du dein Kind.</p>
          }
          @case ('no-game-reports') {
            <p data-qa="child-step-no-game-reports">
              Für die Liga dieses Teams führt der DBB keine Spielberichte. Dein
              Kind kannst du hier deshalb nicht markieren.
            </p>
          }
          @case ('after-first-game') {
            <p data-qa="child-step-after-first-game">{{ afterFirstGame }}</p>
          }
        }
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      flex-basis: 100%;
      justify-items: start;
      gap: 0.5rem;
    }
    :host:empty {
      display: none;
    }
    mat-progress-bar {
      justify-self: stretch;
    }
    p {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildStepComponent {
  public readonly teamId = input.required<TeamId>();
  /** The Team's name, for the labels of a list of several. */
  public readonly teamName = input.required<string>();

  protected readonly afterFirstGame = AFTER_FIRST_GAME_HINT;

  private readonly myTeams = inject(AUSWAHL).teams;
  private readonly today = inject(HEUTE);

  protected readonly followed = computed(
    () => this.myTeams()?.includes(this.teamId()) ?? false
  );

  protected readonly saison = teamSaisonResource(() =>
    this.followed() ? this.teamId() : undefined
  );

  protected readonly failure = computed(() =>
    fehlerText(this.saison.error(), KEIN_TEAM)
  );

  protected readonly step = computed(() =>
    this.saison.hasValue()
      ? childStep(this.saison.value(), this.today())
      : undefined
  );
}
