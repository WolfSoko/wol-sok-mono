import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MedallionComponent } from '../medallion/medallion.component';
import { GameStateQuery } from '../state/game-state.query';
import { DEFAULT_MODE, GameMode } from '../state/game.states';
import { getLevel, Level, LEVELS, nextLevel } from '../state/levels';
import { MedalAward, MEDAL_NAMES, medalRank } from '../state/medallions';
import { Player } from '../state/player.model';
import { Achievement, getAchievement } from '../state/achievements';
import { MatchEarnings } from '../state/earnings';
import { xpClimb } from '../state/ranks';
import { formatScore, rivalryScore, seriesWinner } from '../state/rivalry';
import { getColonyColor } from '../state/colony-colors';
import { ProgressService } from '../progress.service';

/** What the player picked when the match was over. */
export type MatchEndAction = 'again' | 'next' | 'levels' | 'menu';

/**
 * The screen a match ends on: who won, and what to play next. It sits in the
 * game's own panel rather than in a dialog, so it is painted inside a stage
 * that fills the screen like everything else.
 */
@Component({
  selector: 'feat-lazy-bac-game-winner',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MedallionComponent,
  ],
  templateUrl: './winner.component.html',
  styleUrls: ['./winner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinnerComponent {
  private state = inject(GameStateQuery);

  /**
   * Why the next level is still locked on the campaign ladder, null when it
   * is open.
   */
  public readonly upcomingLock = input<string | null>(null);
  /** False where there is no level choice to go to, as in the page layout. */
  public readonly canChooseLevel = input(true);

  /** What the player wants to do next. */
  public readonly action = output<MatchEndAction>();

  /** Null when both colonies wiped each other out in the same step. */
  public winner: Signal<Player | null | undefined> = toSignal(
    this.state.selectWinnerId()
  );

  /** The level that was just played. */
  public level: Signal<Level> = toSignal(this.state.selectLevel(), {
    initialValue: LEVELS[0],
  });

  /** The level that comes next, null after the last one. */
  public upcoming: Signal<Level | null> = computed(() =>
    nextLevel(this.level().id)
  );

  private mode: Signal<GameMode> = toSignal(this.state.selectMode(), {
    initialValue: DEFAULT_MODE,
  });

  /** Everything the match earned, null until it has ended. */
  public earnings: Signal<MatchEarnings | null> = toSignal(
    this.state.selectEarnings(),
    { initialValue: null }
  );

  /** What the match earned against the computer, null between two players. */
  public award: Signal<MedalAward | null> = computed(
    () => this.earnings()?.award ?? null
  );

  /** The achievements the match earned, with their names and conditions. */
  public earned: Signal<readonly Achievement[]> = computed(() =>
    (this.earnings()?.achievements ?? []).map(getAchievement)
  );

  /** The cosmetics the match opened, named. */
  public cosmetics: Signal<readonly string[]> = computed(
    () => this.earnings()?.cosmetics ?? []
  );

  private series = toSignal(this.state.selectSeries(), { initialValue: null });
  private colors = toSignal(this.state.selectColors(), {
    initialValue: ['', ''] as [string, string],
  });
  private couchWins = inject(ProgressService).couchWins;

  /**
   * Between two players: the series score - and who took it, once decided
   * - and the lifetime rivalry of the two colours.
   */
  public duel = computed(() => {
    if (this.mode() !== 'two-players') {
      return null;
    }
    const colors = this.colors();
    const names: [string, string] = [
      getColonyColor(colors[0]).name,
      getColonyColor(colors[1]).name,
    ];
    const series = this.series();
    const taker = series === null ? null : seriesWinner(series);
    return {
      series:
        series === null
          ? null
          : {
              score: formatScore(names, series.wins),
              note:
                taker === null
                  ? `Best of ${series.bestOf}`
                  : `${names[taker]} takes the series!`,
            },
      rivalry: formatScore(names, rivalryScore(this.couchWins(), colors)),
    };
  });

  /** The levels the match opened on the campaign ladder. */
  public unlocked: Signal<readonly Level[]> = computed(() =>
    (this.earnings()?.unlocked ?? []).map(getLevel)
  );

  /**
   * The XP the match earned and, where what was held before is known,
   * where it leaves the player on the way through the ranks.
   */
  public xp = computed(() => {
    const earnings = this.earnings();
    if (earnings === null) {
      return null;
    }
    return {
      gain: earnings.xp,
      climb:
        earnings.xpBefore === null
          ? null
          : xpClimb(earnings.xpBefore, earnings.xp.total),
    };
  });

  /** The medallion line of the award: what was won, or that nothing was. */
  public medalTitle: Signal<string> = computed(() => {
    const award = this.award();
    if (award?.medal == null) {
      return 'No medallion this time';
    }
    const newBest = medalRank(award.medal) > medalRank(award.previousBest);
    return `${MEDAL_NAMES[award.medal]} medallion${newBest ? ' - a new best!' : ''}`;
  });

  /**
   * The better medallion the level already held at this difficulty, null
   * when this match matched or beat it.
   */
  public heldMedal: Signal<string | null> = computed(() => {
    const award = this.award();
    return award?.previousBest != null &&
      medalRank(award.previousBest) > medalRank(award.medal)
      ? MEDAL_NAMES[award.previousBest]
      : null;
  });

  /**
   * One line on how the match ended, addressed to whoever is reading it: a
   * single human against the computer is "you", two humans go by colour.
   */
  public headline: Signal<string> = computed(() => {
    const player = this.winner();
    if (player == null) {
      return 'It is a draw - both colonies wiped each other out!';
    }
    if (player.isBot) {
      return 'The computer wins - your colony was eaten!';
    }
    if (this.mode() === 'vs-computer') {
      return 'You win - the computer colony is gone!';
    }
    return `Congratulations! ${player.name} wins the match!`;
  });
}
