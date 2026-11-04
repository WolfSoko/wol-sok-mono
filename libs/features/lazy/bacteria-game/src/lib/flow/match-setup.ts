import { computed, inject, Injectable } from '@angular/core';
import type { ColorChange } from '../colony-colors/colony-colors.component';
import { ProgressService } from '../progress.service';
import type { BotDifficulty } from '../state/bot-controller';
import { pickColor } from '../state/colony-colors';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import type { HeadStart, SeriesLength } from '../state/rivalry';

/**
 * The setup of the next match as the menus pick it: level, opponent,
 * colours, difficulty and, between two players, the series. Provided by
 * the stage component, one per stage.
 */
@Injectable()
export class MatchSetup {
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly progress = inject(ProgressService);

  /** The level picked for the next match, beside the daily and the run. */
  public readonly selectedLevelId = this.store.levelId;
  /** The level the level choice shows picked - online, the host's. */
  public readonly choiceLevelId = computed(
    () => this.store.online()?.levelId ?? this.selectedLevelId()
  );
  /** Between two players: the series length, the head start. */
  public readonly seriesLength = this.store.seriesLength;
  public readonly headStart = this.store.headStart;

  /** Picks the level the next match is played on - one the ladder opened. */
  public selectLevel(levelId: string): void {
    this.gameStateService.setLevel(levelId);
  }

  /** Gives a seat's colony another colour. */
  public selectColor(change: ColorChange): void {
    // Neither seat may end up with a colour still to earn - a swap would
    // hand the other seat one just as well. A colour a seat has, it keeps.
    const colors = this.store.colors();
    const next = pickColor(colors, change.seat, change.colorId);
    const locks = this.progress.colorLocks();
    if (next.some((id, seat) => id !== colors[seat] && id in locks)) {
      return;
    }
    this.gameStateService.setColor(change.seat, change.colorId);
  }

  /** Picks how hard the computer plays. */
  public selectDifficulty(difficulty: BotDifficulty): void {
    this.gameStateService.setDifficulty(difficulty);
  }

  public selectSeriesLength(length: SeriesLength): void {
    this.gameStateService.setSeriesLength(length);
  }

  public selectHeadStart(headStart: HeadStart): void {
    this.gameStateService.setHeadStart(headStart);
  }
}
