import {
  ChangeDetectionStrategy,
  Component,
  signal,
  Signal,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe, DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MedallionComponent } from '../medallion/medallion.component';
import { GameMode, GameStateStore } from '../state/game.states';
import { getLevel, Level, nextLevel } from '../state/levels';
import { MedalAward, MEDAL_NAMES, medalRank } from '../state/medallions';
import { Player } from '../state/player.model';
import { Achievement, getAchievement } from '../state/achievements';
import { MatchEarnings } from '../state/earnings';
import { xpClimb } from '../state/ranks';
import { formatScore, rivalryScore, seriesWinner } from '../state/rivalry';
import { getColonyColor } from '../state/colony-colors';
import { ProgressService } from '../progress.service';
import { replayLink } from '../state/replay-link';
import { DAILY_ATTEMPTS } from '../state/daily';
import { isRunOver } from '../state/endless';

/** What the player picked when the match was over. */
export type MatchEndAction =
  | 'again'
  | 'next'
  | 'levels'
  | 'menu'
  | 'ghost'
  /** On with the endless run - or a new one, once it is over. */
  | 'endless';

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
  private state = inject(GameStateStore);
  private document = inject(DOCUMENT);
  private clipboard = inject(Clipboard);

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
  public winner: Signal<Player | null> = this.state.winner;

  /** The level that was just played. */
  public level: Signal<Level> = this.state.level;

  /** The level that comes next, null after the last one. */
  public upcoming: Signal<Level | null> = computed(() =>
    nextLevel(this.level().id)
  );

  /** How the match was played - a daily level vs the computer, say. */
  private mode: Signal<GameMode> = this.state.matchMode;

  /** On the daily level: the attempt and the streak, in a line. */
  public dailyNote: Signal<string | null> = computed(() => {
    const daily = this.earnings()?.daily;
    if (daily === undefined) {
      return null;
    }
    const attempt =
      daily.attempt <= DAILY_ATTEMPTS
        ? `attempt ${daily.attempt} of ${DAILY_ATTEMPTS}`
        : 'practice';
    return `Daily level · ${attempt} · ${daily.streak}-day streak`;
  });

  /** The endless run the match was part of, null outside one. */
  public endless = this.state.endless;
  private endlessBest = inject(ProgressService).endlessBest;

  /** Where the endless run stands after the match, in a line. */
  public endlessNote: Signal<string | null> = computed(() => {
    const run = this.endless();
    if (run === null) {
      return null;
    }
    const beaten =
      run.wins === 1 ? '1 level beaten' : `${run.wins} levels beaten`;
    if (isRunOver(run)) {
      return `Endless run over · ${beaten} · best ${this.endlessBest()}`;
    }
    const lives = run.lives === 1 ? '1 life left' : `${run.lives} lives left`;
    return `Endless run · ${beaten} · ${lives}`;
  });

  /** The button that takes the endless run on - null outside one. */
  public endlessAction: Signal<string | null> = computed(() => {
    const run = this.endless();
    if (run === null) {
      return null;
    }
    if (isRunOver(run)) {
      return 'New run';
    }
    return this.winner()?.isBot === false ? 'Next level' : 'Try it again';
  });

  /** True in a match against the player's own ghost. */
  public againstGhost: Signal<boolean> = computed(
    () => this.state.ghost() !== null
  );

  /** What sharing the run came to, under the buttons - null before. */
  public readonly shareNote = signal<string | null>(null);

  /**
   * The link to the run just played, made as soon as the result shows:
   * sharing has to happen right in the tap, the browsers allow no waiting.
   */
  public readonly shareLink = signal<string | null>(null);
  private sharing = false;

  public constructor() {
    effect(() => {
      const run = this.canFightGhost() ? this.state.lastReplay() : null;
      this.shareLink.set(null);
      if (run === null) {
        return;
      }
      replayLink(this.document.location.href, run).then(
        (url) => {
          if (this.state.lastReplay() === run) {
            this.shareLink.set(url);
          }
        },
        () => this.shareNote.set('The link to your run could not be made.')
      );
    });
  }

  /**
   * Shares the link to the run just played, for a friend to fight as a
   * ghost: through the system's share sheet where there is one, else copied.
   */
  public shareRun(): void {
    const url = this.shareLink();
    const run = this.state.lastReplay();
    const navigator = this.document.defaultView?.navigator;
    if (url === null || run === null || navigator == null || this.sharing) {
      return;
    }
    if (typeof navigator.share !== 'function') {
      this.shareNote.set(
        this.clipboard.copy(url)
          ? 'Link copied - send it to a friend to fight your ghost.'
          : 'The link could not be copied.'
      );
      return;
    }
    this.sharing = true;
    navigator
      .share({
        title: 'Bacteria War',
        text: `Beat my run on ${getLevel(run.header.levelId).name}!`,
        url,
      })
      .then(
        () => this.shareNote.set(null),
        (error: unknown) => {
          // Closing the share sheet is no failure.
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            this.shareNote.set('The link could not be shared.');
          }
        }
      )
      .finally(() => (this.sharing = false));
  }

  /**
   * True when the run just played can come back as a ghost - after a match
   * against the computer, not against a ghost already.
   */
  public canFightGhost: Signal<boolean> = computed(
    () =>
      !this.againstGhost() &&
      this.state.lastReplay()?.header.mode === 'vs-computer'
  );

  /** Everything the match earned, null until it has ended. */
  public earnings: Signal<MatchEarnings | null> = this.state.earnings;

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

  private series = this.state.series;
  private colors = this.state.colors;
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
    if (this.againstGhost()) {
      return player.isBot
        ? 'The ghost wins - its run ate your colony!'
        : 'You beat the ghost!';
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
