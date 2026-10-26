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
import { TranslationKey } from '../i18n/dictionaries';
import {
  achievementTexts,
  colonyColorText,
  GameText,
  GameTextPipe,
  ladderLockText,
  levelNameText,
  medalKey,
  playerNameText,
  rankKey,
  renderGameText,
  seriesKey,
} from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { MedallionComponent } from '../medallion/medallion.component';
import { GameMode, GameStateStore } from '../state/game.states';
import { getLevel, Level, nextLevel } from '../state/levels';
import { MedalAward, medalRank } from '../state/medallions';
import { Player } from '../state/player.model';
import { AchievementId } from '../state/achievement-ids';
import { MatchEarnings } from '../state/earnings';
import { xpClimb } from '../state/ranks';
import { formatScore, rivalryScore, seriesWinner } from '../state/rivalry';
import { ProgressService } from '../progress.service';
import { replayLink } from '../state/replay-link';
import { ReplayNoteComponent } from '../replays/replay-note.component';
import { DAILY_ATTEMPTS } from '../state/daily';
import { isRunOver } from '../state/endless';
import { RANKED_DAILY_ATTEMPTS } from '../state/attempts';
import type { UnrankedReason } from '../state/ranked-match';
import { BOSS_SEAT, EndReason } from '../state/win-conditions';
import { SocialService } from '../social/social.service';
import { EvolutionService } from '../evolution.service';
import { DnaHelixComponent } from '../menu/dna-helix.component';
import { dnaEarned } from '../state/evolution';

/** The result screen's line for a match that was not ranked, by why. */
const UNRANKED_KEYS: Readonly<Record<UnrankedReason, TranslationKey>> = {
  offline: 'boards.ranked.result.offline',
  used: 'boards.ranked.result.used',
  'runs-used': 'boards.ranked.result.runsUsed',
  'run-dropped': 'boards.ranked.result.runDropped',
};

/** What the player picked when the match was over. */
export type MatchEndAction =
  | 'again'
  | 'next'
  | 'levels'
  | 'menu'
  | 'ghost'
  // On with the endless run - or a new one, once it is over.
  | 'endless'
  // To the Evolution screen, to spend the DNA the match earned.
  | 'evolve'
  // On to the next training mission.
  | 'mission'
  // From the training to the campaign, once the last mission is done.
  | 'campaign'
  // Watch the match just played again.
  | 'watch';

/**
 * The screen a match ends on: who won, and what to play next. It sits in the
 * game's own panel rather than in a dialog, so it is painted inside a stage
 * that fills the screen like everything else.
 */
@Component({
  selector: 'feat-lazy-bac-game-winner',
  imports: [
    DatePipe,
    DnaHelixComponent,
    GameTextPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MedallionComponent,
    ReplayNoteComponent,
    TranslatePipe,
  ],
  templateUrl: './winner.component.html',
  styleUrls: ['./winner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinnerComponent {
  private state = inject(GameStateStore);
  private document = inject(DOCUMENT);
  private clipboard = inject(Clipboard);
  private i18n = inject(I18nService);

  /**
   * Why the next level is still locked on the campaign ladder, null when it
   * is open. Only whether it is counts: the reason shown is the ladder's
   * own text for the level, in the active language.
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

  /** Why the next level is locked, in the active language - null when open. */
  public upcomingLockText: Signal<GameText | null> = computed(() => {
    const next = this.upcoming();
    return next === null || this.upcomingLock() === null
      ? null
      : ladderLockText(next.id);
  });

  protected readonly levelNameText = levelNameText;
  protected readonly rankKey = rankKey;

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
        ? this.t('match.run.attempt', {
            attempt: daily.attempt,
            total: DAILY_ATTEMPTS,
          })
        : this.t('match.run.practice');
    return this.t('match.run.daily', {
      attempt,
      streak: this.t('match.run.streak', { count: daily.streak }),
    });
  });

  /** The endless run the match was part of, null when it was none of it. */
  private endless = computed(() =>
    this.state.endlessMatch() ? this.state.endless() : null
  );
  private progress = inject(ProgressService);
  private endlessBest = this.progress.endlessBest;

  /** Where the endless run stands after the match, in a line. */
  public endlessNote: Signal<string | null> = computed(() => {
    const run = this.endless();
    if (run === null) {
      return null;
    }
    const beaten = this.t('match.run.beaten', { count: run.wins });
    if (isRunOver(run)) {
      return this.t('match.run.endlessOver', {
        beaten,
        best: this.endlessBest(),
      });
    }
    const lives = this.t('match.run.lives', { count: run.lives });
    return this.t('match.run.endless', { beaten, lives });
  });

  /**
   * Where a training mission's match leaves the training: whether it did
   * the mission, what it fell short of, and whether a mission or the
   * campaign comes next - null outside the training.
   */
  public mission = computed(() => {
    if (this.level().mission === undefined) {
      return null;
    }
    const result = this.earnings()?.training ?? null;
    const done = result !== null && result.shortfall === null;
    return {
      done,
      line:
        result === null
          ? null
          : result.shortfall === null
            ? this.t(
                result.first ? 'training.result.first' : 'training.result.again'
              )
            : this.t('training.result.notYet', {
                goal: this.render(result.shortfall),
              }),
      allDone: result?.allDone === true,
      /** True when there is a mission still to go on to. */
      next: result?.next != null,
    };
  });

  /**
   * What the daily or endless match came to on the leaderboards (ADR
   * 0012): "Ranked attempt 2 of 3", or why it was not ranked - null for
   * any other match, and for one played as practice.
   */
  public rankedNote: Signal<string | null> = computed(() => {
    const note = this.state.rankedNote();
    switch (note?.kind) {
      case 'daily':
        return this.t('boards.ranked.result.daily', {
          n: note.n,
          total: RANKED_DAILY_ATTEMPTS,
        });
      case 'endless':
        return this.t('boards.ranked.result.endless', { match: note.match });
      case 'unranked':
        return this.t(UNRANKED_KEYS[note.reason]);
      default:
        return null;
    }
  });

  /** What the match was part of - the daily level, an endless run - in a line. */
  public runNote: Signal<string | null> = computed(
    () => this.dailyNote() ?? this.endlessNote()
  );

  /** The button that takes the endless run on - null outside one. */
  public endlessAction: Signal<TranslationKey | null> = computed(() => {
    const run = this.endless();
    if (run === null) {
      return null;
    }
    if (isRunOver(run)) {
      return 'match.actions.newRun';
    }
    return this.winner()?.isBot === false
      ? 'match.actions.nextLevel'
      : 'match.actions.tryAgain';
  });

  /**
   * True after a match between two devices - also once the other one left,
   * which ended it.
   */
  public online: Signal<boolean> = computed(
    () =>
      this.state.online() !== null ||
      this.state.endedBy() === 'forfeit' ||
      this.state.endedBy() === 'desync'
  );

  private readonly social = inject(SocialService);
  /** The opponent of an online match, to add as a friend - null otherwise. */
  public readonly newFriend = computed(() => {
    const opponent = this.social.opponent();
    return this.online() && opponent !== null && !this.social.opponentIsFriend()
      ? opponent
      : null;
  });
  /** What adding the opponent came to - null before. */
  public readonly friendNote = signal<TranslationKey | null>(null);

  /** Asks the opponent of the online match to be friends. */
  public async addFriend(uid: string): Promise<void> {
    try {
      await this.social.addFriend(uid);
      this.friendNote.set('match.friend.sent');
    } catch (error) {
      console.error('Could not send the friend request', error);
      this.friendNote.set('match.friend.failed');
    }
  }

  /** True while the online connection holds. */
  public connected: Signal<boolean> = computed(
    () => this.state.online() !== null
  );

  /**
   * True for the guest of an online match, who waits for the host to start
   * the next one.
   */
  public onlineGuest: Signal<boolean> = computed(
    () => this.state.online()?.seat === 1
  );

  /** True in a match against the player's own ghost. */
  public againstGhost: Signal<boolean> = computed(
    () => this.state.ghost() !== null
  );

  /** What sharing the run came to, under the buttons - null before. */
  public readonly shareNote = signal<TranslationKey | null>(null);

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
        () => this.shareNote.set('match.share.linkFailed')
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
          ? 'match.share.copied'
          : 'match.share.copyFailed'
      );
      return;
    }
    this.sharing = true;
    navigator
      .share({
        title: 'Bacteria Wars',
        text: this.t('match.share.text', {
          level: this.render(levelNameText(getLevel(run.header.levelId))),
        }),
        url,
      })
      .then(
        () => this.shareNote.set(null),
        (error: unknown) => {
          // Closing the share sheet is no failure.
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            this.shareNote.set('match.share.shareFailed');
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
  public earned: Signal<
    readonly { id: AchievementId; name: GameText; condition: GameText }[]
  > = computed(() =>
    (this.earnings()?.achievements ?? []).map((id) => ({
      id,
      ...achievementTexts(id),
    }))
  );

  /**
   * The cosmetics the match opened, named - as texts to translate where
   * the earnings carry them, else the English names.
   */
  public cosmetics: Signal<readonly string[]> = computed(() => {
    const earnings = this.earnings();
    return (
      earnings?.cosmeticTexts?.map((text) => this.render(text)) ??
      earnings?.cosmetics ??
      []
    );
  });

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
      this.colorName(colors[0]),
      this.colorName(colors[1]),
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
                  ? this.t(seriesKey(series.bestOf))
                  : this.t('match.duel.takesSeries', { name: names[taker] }),
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
      // The XP lines in the active language, the English label where a
      // line carries no text.
      parts: earnings.xp.parts.map((part) => ({
        label: part.text === undefined ? part.label : this.render(part.text),
        xp: part.xp,
      })),
      climb:
        earnings.xpBefore === null
          ? null
          : xpClimb(earnings.xpBefore, earnings.xp.total),
    };
  });

  private readonly evolution = inject(EvolutionService);

  /**
   * The strands of DNA the match's XP grew, null where what was held before
   * is not known - or where it grew none.
   */
  public readonly dna = computed(() => {
    const earnings = this.earnings();
    if (earnings === null || earnings.xpBefore === null) {
      return null;
    }
    const before = earnings.xpBefore;
    const gained = dnaEarned(before + earnings.xp.total) - dnaEarned(before);
    return gained > 0 ? gained : null;
  });

  /** True when the DNA left buys something: the way to the Evolution screen. */
  public readonly canEvolve = computed(
    () =>
      this.earnings() !== null && !this.online() && this.evolution.canEvolve()
  );

  /** The medallion line of the award: what was won, or that nothing was. */
  public medalTitle: Signal<string> = computed(() => {
    const award = this.award();
    if (award?.medal == null) {
      return this.t('match.medal.none');
    }
    const newBest = medalRank(award.medal) > medalRank(award.previousBest);
    return this.t(newBest ? 'match.medal.newBest' : 'common.medal', {
      medal: this.t(medalKey(award.medal)),
    });
  });

  /**
   * The better medallion the level already held at this difficulty, null
   * when this match matched or beat it.
   */
  public heldMedal: Signal<string | null> = computed(() => {
    const award = this.award();
    return award?.previousBest != null &&
      medalRank(award.previousBest) > medalRank(award.medal)
      ? this.t(medalKey(award.previousBest))
      : null;
  });

  /**
   * One line on how the match ended, addressed to whoever is reading it: a
   * single human against the computer is "you", two humans go by colour.
   */
  public headline: Signal<string> = computed(() => {
    const player = this.winner();
    if (this.online()) {
      return this.t(onlineHeadline(player, this.state.endedBy()));
    }
    if (this.state.endedBy() === 'time') {
      return this.goalReached(player, TIME_UP);
    }
    if (this.state.endedBy() === 'hold' && player != null) {
      return this.goalReached(player, HELD);
    }
    if (this.state.endedBy() === 'harvest' && player != null) {
      return this.goalReached(player, HARVESTED);
    }
    if (
      this.level().boss !== undefined &&
      !this.againstGhost() &&
      player != null
    ) {
      return this.bossFight(player);
    }
    if (player == null) {
      return this.t('match.headline.draw');
    }
    if (this.againstGhost()) {
      return this.t(
        player.isBot ? 'match.headline.ghostWins' : 'match.headline.ghostBeaten'
      );
    }
    if (player.isBot) {
      return this.t('match.headline.computerWins');
    }
    if (this.mode() === 'vs-computer') {
      return this.t('match.headline.youWin');
    }
    return this.t('match.headline.playerWins', {
      name: this.playerName(player),
    });
  });

  /** The headline of a chapter's finale against a boss. */
  private bossFight(player: Player): string {
    const survived = this.state.endedBy() === 'survive';
    const name = this.playerName(player);
    if (player.id === BOSS_SEAT) {
      return this.mode() === 'vs-computer'
        ? this.t('match.headline.boss.wins')
        : this.t('match.headline.boss.playerIsBoss', { name });
    }
    if (this.mode() !== 'vs-computer') {
      return this.t(
        survived
          ? 'match.headline.boss.playerSurvived'
          : 'match.headline.boss.playerBeat',
        { name }
      );
    }
    return this.t(
      survived
        ? 'match.headline.boss.youSurvived'
        : 'match.headline.boss.youBeat'
    );
  }

  /**
   * The headline of a match a colony won by reaching the level's goal -
   * holding the zone, eating up enough pellets first - or by being the
   * bigger one when the clock ran out; `lines` has the sentences for it.
   */
  private goalReached(player: Player | null, lines: GoalLines): string {
    if (player == null) {
      return this.t('match.headline.time.draw');
    }
    if (this.againstGhost()) {
      return this.t(player.isBot ? lines.ghost : lines.youBeatGhost);
    }
    if (player.isBot) {
      return this.t(lines.computer);
    }
    return this.mode() === 'vs-computer'
      ? this.t(lines.you)
      : this.t(lines.player, { name: this.playerName(player) });
  }

  /** A player's name in the active language - an online name as it is. */
  private playerName(player: Player): string {
    const text = playerNameText(player.name);
    return text === null ? player.name : this.render(text);
  }

  /** A colony colour's name in the active language. */
  private colorName(id: string): string {
    return this.render(colonyColorText(id));
  }

  private t(key: TranslationKey, params?: Record<string, string | number>) {
    return this.i18n.t(key, params);
  }

  private render(text: GameText): string {
    return renderGameText(text, (key, params) => this.i18n.t(key, params));
  }
}

/** The sentences of a won goal, by who reached it. */
interface GoalLines {
  ghost: TranslationKey;
  youBeatGhost: TranslationKey;
  computer: TranslationKey;
  you: TranslationKey;
  player: TranslationKey;
}

function goalLines(goal: 'hold' | 'harvest' | 'time'): GoalLines {
  return {
    ghost: `match.headline.${goal}.ghost`,
    youBeatGhost: `match.headline.${goal}.youBeatGhost`,
    computer: `match.headline.${goal}.computer`,
    you: `match.headline.${goal}.you`,
    player: `match.headline.${goal}.player`,
  };
}

const HELD = goalLines('hold');
const HARVESTED = goalLines('harvest');
const TIME_UP = goalLines('time');

/** The reasons an online match ends with a winner, each with its lines. */
const ONLINE_DEEDS = [
  'annihilation',
  'time',
  'hold',
  'survive',
  'harvest',
] as const satisfies readonly EndReason[];
type OnlineDeed = (typeof ONLINE_DEEDS)[number] | 'other';

/**
 * The headline of an online match, for the player at this device: the
 * other device's colony is "your opponent".
 */
function onlineHeadline(
  winner: Player | null,
  reason: EndReason | null
): TranslationKey {
  if (reason === 'forfeit') {
    return 'match.headline.online.forfeit';
  }
  if (reason === 'desync') {
    return 'match.headline.online.desync';
  }
  if (winner === null) {
    return reason === 'time'
      ? 'match.headline.time.draw'
      : 'match.headline.draw';
  }
  const deed: OnlineDeed = (ONLINE_DEEDS as readonly string[]).includes(
    reason ?? 'annihilation'
  )
    ? ((reason ?? 'annihilation') as OnlineDeed)
    : 'other';
  return winner.isBot
    ? `match.headline.online.opponent.${deed}`
    : `match.headline.online.you.${deed}`;
}
