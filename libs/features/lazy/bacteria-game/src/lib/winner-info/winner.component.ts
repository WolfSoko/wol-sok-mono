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
import { rankFor } from '../state/ranks';

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

  /** The levels the match opened on the campaign ladder. */
  public unlocked: Signal<readonly Level[]> = computed(() =>
    (this.earnings()?.unlocked ?? []).map(getLevel)
  );

  /**
   * The XP the match earned and where it leaves the player: the rank, a
   * new one or not, and the bar towards the next - the part held before,
   * and the part this match added.
   */
  public xp = computed(() => {
    const earnings = this.earnings();
    if (earnings === null) {
      return null;
    }
    const xp = earnings.xpBefore + earnings.xp.total;
    const before = rankFor(earnings.xpBefore);
    const after = rankFor(xp);
    const rankUp = after.number > before.number;
    const held = rankUp ? 0 : before.progress;
    return {
      gain: earnings.xp,
      standing: after,
      rankUp,
      heldPercent: 100 * held,
      gainedPercent: 100 * (after.progress - held),
      toNext: after.next === null ? null : after.next.xp - xp,
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
