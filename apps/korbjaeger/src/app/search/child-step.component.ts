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
import { SELECTION } from '../selection/selection';
import { gameDetailsResource } from '../basketball-data/game-details-resource';
import { oldestAsOf } from '../basketball-data/as-of';
import { teamSeasonResource } from '../basketball-data/team-season-resource';
import { errorText, NO_TEAM } from '../errors/error-text';
import { TODAY } from '../today';
import { AFTER_FIRST_GAME_HINT } from '../child/child-hints';
import { AsOfComponent } from '../as-of/as-of.component';
import { checkedChildStep, childStep } from './child-step';

/**
 * The next step of the search "Über mein Kind" for one of a Verein's
 * Teams, once it is followed: the link to its last played Spiel, whose
 * Kader offers to mark the Kind, or why there is none: no Spiel yet, or
 * a Liga the DBB keeps no Spielberichte for, which only the Spiel's details
 * tell. Shows nothing for a Team not followed, and reads its Saison only
 * once it is.
 */
@Component({
  selector: 'korb-child-step',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    AsOfComponent,
  ],
  template: `
    @if (followed()) {
      @if (season.isLoading() || waitingForDetails()) {
        <mat-progress-bar
          mode="indeterminate"
          [attr.aria-label]="'Spiele von ' + teamName() + ' werden geladen'"
        />
      } @else if (failure(); as text) {
        <p class="error" data-qa="child-step-failure">{{ text }}</p>
      } @else if (shown(); as step) {
        <korb-as-of data-qa="child-step-as-of" [asOf]="asOf()" />
        @switch (step.kind) {
          @case ('mark') {
            <a
              matButton="filled"
              data-qa="child-step-mark"
              [routerLink]="['/spiel', step.gameId]"
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

  private readonly myTeams = inject(SELECTION).teams;
  private readonly today = inject(TODAY);

  protected readonly followed = computed(
    () => this.myTeams()?.includes(this.teamId()) ?? false
  );

  protected readonly season = teamSeasonResource(() =>
    this.followed() ? this.teamId() : undefined
  );

  protected readonly failure = computed(() =>
    errorText(this.season.error(), NO_TEAM)
  );

  private readonly step = computed(() =>
    this.season.hasValue()
      ? childStep(this.season.value(), this.today())
      : undefined
  );

  /** The details of the Spiel the step leads to, for its Liga. */
  protected readonly details = gameDetailsResource(() => {
    const step = this.step();
    return step?.kind === 'mark' ? step.gameId : undefined;
  });

  /** Only until the first details came: a reload keeps the step shown. */
  protected readonly waitingForDetails = computed(
    () => this.details.isLoading() && !this.details.hasValue()
  );

  /** The oldest of the reads the step stands on. */
  protected readonly asOf = computed(() =>
    oldestAsOf(this.season.asOf(), this.details.asOf())
  );

  protected readonly shown = computed(() => {
    const step = this.step();
    const details = this.details.hasValue() ? this.details.value() : undefined;
    return step && checkedChildStep(step, details);
  });
}
