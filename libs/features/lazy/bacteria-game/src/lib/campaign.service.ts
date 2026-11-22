import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { ProgressService } from './progress.service';
import { GameSettingsService } from './settings.service';
import {
  achievementTally,
  activeArena,
  CampaignSummary,
  continueText,
  difficultyOption,
  furthestOpenLevel,
  getLevel,
  isLadderLevel,
  LEVELS,
  medalTally,
  ONLINE_LOCKS,
} from '@wolsok/feat-shared-bacteria-engine';
import { GameStateStore } from './state/game.states';
import { GameStateService } from './state/game-state.service';

/**
 * Holds the campaign ladder against the computer: which levels are locked,
 * and that a locked one is never the level a match starts on.
 *
 * However a locked level got selected - restored from an earlier visit,
 * picked in free play or between two players - it falls back to the
 * furthest open level. Not before the progress is known, which would reset
 * levels that are open, and not during a match.
 */
@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly progress = inject(ProgressService);
  private readonly settings = inject(GameSettingsService);
  private readonly gameState = inject(GameStateService);
  private readonly store = inject(GameStateStore);

  private readonly mode = this.store.mode;
  private readonly levelId = this.store.levelId;
  private readonly matchOn = this.store.isMatchOn;
  private readonly difficulty = this.store.difficulty;

  /**
   * The arena every level is drawn in - the one chosen in the settings once
   * it is earned - null for each level its own.
   */
  public readonly activeArena = computed(() =>
    activeArena(this.settings.value('arena'), this.progress.arenaLocks())
  );

  /** The furthest level the ladder has opened - where Continue picks up. */
  public readonly furthestLevel = computed(() =>
    furthestOpenLevel(this.progress.ladderLocks())
  );

  /** Where the player stands on the ladder, for the main menu. */
  public readonly summary = computed((): CampaignSummary => ({
    openLevels: LEVELS.length - Object.keys(this.progress.ladderLocks()).length,
    medals: medalTally(this.progress.medals()),
    achievements: achievementTally(this.progress.achievements()).earned,
    xp: this.progress.xp(),
    continueLabel: `${getLevel(this.furthestLevel()).name} · ${difficultyOption(this.difficulty())?.name ?? ''}`,
    continueText: continueText(this.furthestLevel(), this.difficulty()),
  }));

  /**
   * True while the campaign's ladder applies - against the computer, no free
   * play, and not in an online room, whose host picks any level that plays
   * online for the two players.
   */
  private readonly onLadder = computed(
    () =>
      this.mode() === 'vs-computer' &&
      !this.settings.value('freePlay') &&
      this.store.matchRules().locks === 'campaign'
  );

  /**
   * Why each level is still locked, by level id - the open ones are absent,
   * and all of them in free play, between two players and online, who have
   * nothing to prove to the computer.
   */
  public readonly locks = computed((): Readonly<Record<string, string>> => {
    if (this.store.matchRules().locks === 'online') {
      return ONLINE_LOCKS;
    }
    return this.onLadder() ? this.progress.ladderLocks() : {};
  });

  constructor() {
    // On the ladder, the next match is on a level of it that is open - a
    // locked one, or a generated one picked in free play, gives way.
    effect(() => {
      const locks = this.locks();
      const id = this.levelId();
      if (
        this.progress.loaded() &&
        !this.matchOn() &&
        this.onLadder() &&
        (id in locks || !isLadderLevel(id))
      ) {
        untracked(() => this.gameState.setLevel(furthestOpenLevel(locks)));
      }
    });
  }
}
