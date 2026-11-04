import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs/operators';
import { GameHapticsService } from '../haptics.service';
import { HudState } from '../hud/hud-state';
import { GameSoundService } from '../sound/game-sound.service';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { MatchResult, MissionId } from '@wolsok/feat-shared-bacteria-engine';
import type { MatchEndAction } from '../winner-info/winner.component';
import { levelsEntry, screenAfterMatch } from './play-kind';
import { PlayFlow } from './play-flow';

/** The ways on from the result screen that start a match at once. */
const STARTS_AT_ONCE: ReadonlySet<MatchEndAction> = new Set([
  'again',
  'next',
  'ghost',
]);

/** The ways on that leave the series and the online match behind. */
const LEAVES_PLAY: ReadonlySet<MatchEndAction> = new Set([
  'menu',
  'evolve',
  'watch',
]);

/**
 * The end of a match on the stage: its sound and buzz, and the ways on
 * from the result screen. Provided by the stage component, one per stage.
 */
@Injectable()
export class MatchEnd {
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly sound = inject(GameSoundService);
  private readonly haptics = inject(GameHapticsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hud = inject(HudState);
  private readonly flow = inject(PlayFlow);

  constructor() {
    effect(() => {
      if (this.hud.matchOver()) {
        untracked(() => this.finishMatch());
      }
    });
  }

  /**
   * Clears the arena after a match and, unless the player heads back to the
   * menu, kicks off the next one right away - on the following level for
   * "next level".
   */
  public onMatchEnd(action: MatchEndAction): void {
    if (action === 'next' && this.hud.upcomingLock() !== null) {
      return;
    }
    const next = action === 'next' ? this.hud.upcomingLevel() : null;
    // Where the training goes on, as the mission's result says.
    const mission =
      action === 'mission'
        ? (this.store.snapshot().earnings?.training?.next ?? null)
        : null;
    // The reset ends a match set outside the setup: a rematch sets it again.
    const rematch =
      action === 'again' ? this.gameStateService.oneMatch() : null;
    if (action === 'levels') {
      this.flow.newGameEntry.set(levelsEntry(this.flow.playKind()));
    }
    this.flow.screen.set(screenAfterMatch(action));
    if (LEAVES_PLAY.has(action)) {
      this.gameStateService.endSeries();
      this.gameStateService.leaveOnline();
    }
    this.flow
      .resetGame$()
      .pipe(
        tap(() => {
          // An online start that waited for the clear arena plays instead.
          if (this.hud.running()) {
            return;
          }
          // Only once the old arena has turned to dust: switched before, the
          // next level would flash up just to be vaporized with the old one.
          if (next != null) {
            this.gameStateService.setLevel(next.id);
          }
          if (action === 'ghost') {
            this.gameStateService.playGhost();
          } else if (rematch !== null) {
            this.gameStateService.replayOneMatch(rematch);
          }
          if (action === 'endless') {
            void this.flow.continueRun();
            return;
          }
          if (rematch?.dailyDay != null) {
            // Again on the daily level: ranked again where it may be.
            void this.flow.playDaily();
            return;
          }
          this.playOn(action, mission);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  /** Starts what the way on starts once the arena is clear, if anything. */
  private playOn(action: MatchEndAction, mission: MissionId | null): void {
    if (mission !== null) {
      this.flow.pickMission(mission);
      this.gameStateService.playMission(mission);
    }
    if (action === 'campaign') {
      this.flow.playFurthestLevel();
    } else if (STARTS_AT_ONCE.has(action) || mission !== null) {
      this.flow.startGame();
    }
  }

  /** Plays the end of the match, and the medallion it earned after it. */
  private finishMatch(): void {
    const medal = this.store.snapshot().earnings?.award?.medal ?? null;
    const result = this.matchResult();
    this.sound.matchEnd(result, medal);
    this.haptics.matchEnd(result, medal != null);
  }

  /**
   * How the match ended for the people at the screen: against the computer a
   * win or a loss, between two players always a win for one of them.
   */
  private matchResult(): MatchResult {
    const winner = this.store.snapshot().winner;
    if (winner == null) {
      return 'draw';
    }
    return winner.isBot ? 'loss' : 'win';
  }
}
