import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import type {
  GameIrregularity,
  GameOutcome,
} from '@wolsok/feat-shared-basketball-data';
import { PROVISIONAL } from './game-format';
import type { GameRow } from './game-row';

/**
 * One Spiel as a line, on the Team page and the overview alike: home or
 * away and the opponent, day and time, the Liga where asked, and the
 * result (vorläufig while `resultProvisional` says so) and whether it was
 * cancelled or forfeited.
 */
@Component({
  selector: 'korb-game-row',
  imports: [MatChipsModule],
  template: `
    @let game = row();
    @if (heading(); as text) {
      <span class="title">{{ text }}</span>
    }
    <span class="who">
      @if (game.homeOrAway) {
        <span data-qa="game-home-or-away">{{ game.homeOrAway }}</span> gegen
      }
      <span data-qa="game-opponent">{{ game.opponent }}</span>
    </span>
    <span class="when">
      <span data-qa="game-date">{{ game.date }}</span>
      @if (game.time) {
        · <span data-qa="game-time">{{ game.time }}</span> Uhr
      }
    </span>
    @if (withLeague()) {
      <span class="league" data-qa="game-league">{{ game.league }}</span>
    }
    @if (game.result || game.outcome || game.irregularity) {
      <span class="outcome">
        @if (game.outcome; as outcome) {
          <span
            class="outcome-badge"
            [class]="outcome"
            data-qa="game-outcome"
            >{{ outcomeText[outcome] }}</span
          >
        }
        @if (game.result) {
          &ngsp;<span class="result" data-qa="game-result">{{
            game.result
          }}</span>
        }
        @if (game.provisional) {
          &ngsp;<span class="provisional" data-qa="game-provisional">{{
            provisionalText
          }}</span>
        }
        @if (game.irregularity) {
          &ngsp;<mat-chip class="irregularity" data-qa="game-irregularity">{{
            irregularityText[game.irregularity]
          }}</mat-chip>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1fr auto;
      column-gap: 1rem;
      align-items: start;
    }
    .title,
    .who,
    .when,
    .league {
      grid-column: 1;
    }
    .title {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .who {
      font: var(--mat-sys-body-large);
    }
    .when,
    .league {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .outcome {
      grid-column: 2;
      grid-row: 1 / span 4;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .result {
      font: var(--mat-sys-title-large);
      font-weight: var(--mat-sys-title-large-weight);
      font-variant-numeric: tabular-nums;
    }
    .provisional {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .outcome-badge {
      padding: 0.125rem 0.5rem;
      border-radius: var(--mat-sys-corner-extra-small);
      font: var(--mat-sys-label-large);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .win {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .loss {
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface);
    }
    .irregularity {
      --mat-chip-elevated-container-color: var(--mat-sys-error-container);
      --mat-chip-label-text-color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameRowComponent {
  public readonly row = input.required<GameRow>();
  /** A heading above the line, e.g. "Nächstes Spiel". */
  public readonly heading = input<string>();
  /** Whether to name the Spiel's Liga. */
  public readonly withLeague = input(false, { transform: booleanAttribute });

  protected readonly provisionalText = PROVISIONAL;

  /** How a result reads: in words, never by colour alone. */
  protected readonly outcomeText: Record<GameOutcome, string> = {
    win: 'Sieg',
    loss: 'Niederlage',
  };

  /** How a Spiel out of the plain schedule reads, as the DBB words it. */
  protected readonly irregularityText: Record<GameIrregularity, string> = {
    cancelled: 'abgesagt',
    forfeited: 'kampflos',
  };
}
