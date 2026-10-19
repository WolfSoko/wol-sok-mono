import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProgressService } from './progress.service';
import { GameSettingsService } from './settings.service';
import { difficultyOption } from './state/bot-controller';
import { CampaignSummary, furthestOpenLevel } from './state/campaign';
import { getLevel, LEVELS } from './state/levels';
import { medalTally } from './state/progress';
import { GameStateQuery } from './state/game-state.query';
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
  private readonly query = inject(GameStateQuery);

  private readonly mode = toSignal(this.query.selectMode(), {
    requireSync: true,
  });
  private readonly levelId = toSignal(
    this.query.select((state) => state.levelId),
    { requireSync: true }
  );
  private readonly matchOn = toSignal(this.query.selectIsMatchOn(), {
    requireSync: true,
  });
  private readonly difficulty = toSignal(this.query.selectDifficulty(), {
    requireSync: true,
  });

  /** The furthest level the ladder has opened - where Continue picks up. */
  public readonly furthestLevel = computed(() =>
    furthestOpenLevel(this.progress.ladderLocks())
  );

  /** Where the player stands on the ladder, for the main menu. */
  public readonly summary = computed((): CampaignSummary => ({
    openLevels: LEVELS.length - Object.keys(this.progress.ladderLocks()).length,
    medals: medalTally(this.progress.medals()),
    continueLabel: `${getLevel(this.furthestLevel()).name} · ${difficultyOption(this.difficulty())?.name ?? ''}`,
  }));

  /**
   * Why each level is still locked, by level id - the open ones are absent,
   * and all of them in free play and between two players, who have nothing
   * to prove to the computer.
   */
  public readonly locks = computed((): Readonly<Record<string, string>> =>
    this.mode() === 'vs-computer' && !this.settings.freePlay()
      ? this.progress.ladderLocks()
      : {}
  );

  constructor() {
    effect(() => {
      const locks = this.locks();
      if (
        this.progress.loaded() &&
        !this.matchOn() &&
        this.levelId() in locks
      ) {
        untracked(() => this.gameState.setLevel(furthestOpenLevel(locks)));
      }
    });
  }
}
