import {
  afterNextRender,
  computed,
  DestroyRef,
  inject,
  Injectable,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, Observable, of, Subject } from 'rxjs';
import { catchError, defaultIfEmpty, last, map, tap } from 'rxjs/operators';
import { armedTap } from '../armed-tap';
import { StageBusy } from '../busy/stage-busy';
import { CampaignService } from '../campaign.service';
import { GameHapticsService } from '../haptics.service';
import { HudState } from '../hud/hud-state';
import { I18nService } from '../i18n/i18n.service';
import { DailyCard } from '../menu/menu-cards';
import { NewGameEntry, opponentOf, PlayKind } from '../menu/play-modes';
import { ProgressService } from '../progress.service';
import { RankedService } from '../ranked/ranked.service';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from '../sound/game-sound.service';
import { levelMusic } from '../sound/level-music';
import { ArenaStage } from '../stage/arena-stage';
import { StageFrame } from '../stage/stage-frame';
import { StageFullscreen } from '../stage/stage-fullscreen';
import {
  isRunOver,
  MissionId,
  ONLINE_LOCKS,
} from '@wolsok/feat-shared-bacteria-engine';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { playKindOf } from './play-kind';
import type { MenuScreen, StagePanel } from './stage-screens';

/**
 * The way through the game on one stage: which menu screen or panel is
 * open, the modes a new game sets up and starts - the campaign, the
 * training, the daily level, an endless run, free play - with their ranked
 * declarations, and starting, pausing and clearing a match. Provided by the
 * stage component, one per stage.
 */
@Injectable()
export class PlayFlow {
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly busy = inject(StageBusy);
  private readonly settings = inject(GameSettingsService);
  private readonly sound = inject(GameSoundService);
  private readonly haptics = inject(GameHapticsService);
  private readonly i18n = inject(I18nService);
  private readonly progress = inject(ProgressService);
  private readonly campaign = inject(CampaignService);
  private readonly ranked = inject(RankedService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hud = inject(HudState);
  private readonly stageFullscreen = inject(StageFullscreen);
  private readonly arenaStage = inject(ArenaStage);
  private readonly stageFrame = inject(StageFrame);
  private readonly cleared = new Subject<void>();
  /**
   * Counts the matches started and the resets begun: a start that waited -
   * for a declaration, for the arena - sees by it whether the stage moved
   * on meanwhile, even when that match is over again by then.
   */
  private stageMoves = 0;

  /**
   * Which of the menu screens is open while no match runs - and, while one
   * is paused, whether the settings are open on top of the pause menu.
   */
  public readonly screen = signal<MenuScreen>('menu');
  /**
   * True while the arena is being cleared after a match: the state passes
   * through "paused" then, which is not a pause the player asked for.
   */
  public readonly resetting = signal(false);
  /**
   * Fires each time the arena is clear again after a reset, whatever the
   * reset came to - for what waited for it, as an online start does.
   */
  public readonly arenaCleared$ = this.cleared.asObservable();
  /**
   * The panel laid over the arena: the match result, the pause menu, one of
   * the menu screens - or none, while a match is on.
   */
  public readonly panel = computed<StagePanel>(() => {
    if (this.resetting()) {
      return null;
    }
    if (this.hud.matchOver()) {
      return 'over';
    }
    if (this.hud.paused()) {
      return this.screen() === 'settings' ? 'settings' : 'pause';
    }
    return this.hud.running() ? null : this.screen();
  });
  /**
   * True while a menu screen fills the stage: what lies under it - the
   * arena, its bar and the seats - is out of reach then.
   */
  public readonly screenOpen = computed(() => {
    const panel = this.panel();
    return panel !== null && panel !== 'pause' && panel !== 'over';
  });
  /** The settings' way back: to the pause menu during a match. */
  public readonly settingsBackLabel = computed(() =>
    this.i18n.t(this.hud.paused() ? 'stage.pause.back' : 'common.menu')
  );

  /** True while a ranked attempt is being declared. */
  public readonly declaring = signal(false);
  /** Ranked play as the new game offers it, by mode. */
  public readonly rankedOffers = computed(() => ({
    daily: this.ranked.offer('daily', this.settings.value('ranked')),
    endless: this.ranked.offer('endless', this.settings.value('ranked')),
  }));

  /** Where a new game opens - on the mode last played, to pick another. */
  public readonly newGameEntry = signal<NewGameEntry>({
    kind: null,
    step: 'mode',
  });
  /** The levels of the ladder open so far, for the campaign's mode card. */
  public readonly openLevels = computed(
    () => this.campaign.summary().openLevels
  );
  /** The mode picked in a new game this visit, null before. */
  private readonly lastKind = signal<PlayKind | null>(null);
  /** The mode last played, see `playKindOf`. */
  public readonly playKind = computed((): PlayKind => {
    return playKindOf({
      matchKind: this.store.matchRules().kind,
      lastKind: this.lastKind(),
      mode: this.store.mode(),
      freePlay: this.settings.value('freePlay'),
    });
  });
  /**
   * The locked levels of the level choice: the ladder's, and online the
   * big maps, which the CPU both devices run cannot keep up with.
   */
  public readonly choiceLocks = computed(() =>
    this.lastKind() === 'online' ? ONLINE_LOCKS : this.campaign.locks()
  );

  /** Today's daily level for the main menu. */
  public readonly dailyCard = computed((): DailyCard => {
    const { levelId, attemptsLeft, streak } = this.progress.daily();
    return { levelId, attemptsLeft, streak };
  });
  /**
   * The mission the player picked - kept whatever the progress tells
   * meanwhile - null to offer the first one still to do.
   */
  private readonly pickedMission = signal<MissionId | null>(null);
  /**
   * The training mission picked in a new game - the first one still to do
   * until the player picks another.
   */
  public readonly missionId = computed(
    () => this.pickedMission() ?? this.progress.firstOpenMission()
  );

  /** "Give up" in two taps. */
  private readonly giveUpTap = armedTap<true>();
  /** True while the first tap on "Give up" waits for the second. */
  public readonly giveUpArmed = computed(() => this.giveUpTap.armed() !== null);

  /** Opens one of the menu screens. */
  public show(screen: MenuScreen): void {
    if (screen !== this.screen()) {
      this.sound.navigate();
    }
    this.screen.set(screen);
  }

  /** Opens a new game on its first step. */
  public openNewGame(): void {
    this.newGameEntry.set({ kind: this.playKind(), step: 'mode' });
    this.show('new-game');
    // Today's ranked attempts and runs left, for the daily and endless -
    // read once each visit, which picking a mode then takes from.
    void this.ranked.refresh();
  }

  /** Opens a new game on a mode's step, as a way in from elsewhere. */
  public openNewGameOn(entry: NewGameEntry & { kind: PlayKind }): void {
    this.setPlayKind(entry.kind);
    this.newGameEntry.set(entry);
    this.show('new-game');
  }

  /**
   * Sets the game up for a mode: who plays, and whether the ladder's locks
   * apply - the campaign service keeps the next match on an open ladder
   * level while they do.
   */
  public setPlayKind(kind: PlayKind): void {
    this.lastKind.set(kind);
    if (kind !== 'online') {
      // Another mode is no online match.
      this.gameStateService.leaveOnline();
    }
    const opponent = opponentOf(kind);
    if (opponent !== null) {
      this.gameStateService.setMode(opponent);
    }
    if (kind === 'campaign' || kind === 'free') {
      this.settings.set('freePlay', kind === 'free');
    }
    if (kind === 'daily' || kind === 'endless') {
      void this.ranked.refresh(false);
    }
  }

  /**
   * Starts what a new game set up: a match, the daily level, a run or a
   * training mission.
   */
  public startNewGame(kind: PlayKind): void {
    // The host's online start stays in step with the lockstep's own starts.
    if (kind === 'online') {
      this.startGame();
      return;
    }
    this.startOnTap(() => {
      switch (kind) {
        case 'daily':
          return this.playDaily();
        case 'endless':
          return this.playEndless();
        case 'training':
          return this.playMission(this.missionId());
        default:
          return this.startGame();
      }
    });
  }

  /** Picks a training mission for the next start. */
  public pickMission(id: MissionId): void {
    this.pickedMission.set(id);
  }

  /** Starts a training mission's match. */
  public playMission(id: MissionId): void {
    if (this.resetting()) {
      return;
    }
    this.pickedMission.set(id);
    this.gameStateService.leaveOnline();
    this.gameStateService.playMission(id);
    this.startGame();
  }

  /** Opens the training's missions, from the main menu. */
  public openTraining(): void {
    // Offers the first mission still to do.
    this.pickedMission.set(null);
    this.openNewGameOn({ kind: 'training', step: 'level' });
  }

  /**
   * Starts a new endless run, on its first level - a ranked one (ADR 0012)
   * where ranked play is offered and wanted: its match 0 declared first.
   */
  public async playEndless(): Promise<void> {
    if (this.resetting() || this.declaring()) {
      return;
    }
    this.gameStateService.leaveOnline();
    if (this.ranked.wants('endless', this.settings.value('ranked'))) {
      const moves = this.stageMoves;
      const start = await this.whileDeclaring(() => this.ranked.startRun());
      if (this.movedSince(moves)) {
        return;
      }
      this.gameStateService.startEndless(start);
    } else {
      this.gameStateService.startEndless();
    }
    await this.startWhenArenaReady();
  }

  /**
   * Starts a match on today's daily level, against the computer - a ranked
   * attempt (ADR 0012) where ranked play is offered and wanted, declared
   * first: it then plays the ranked setup from the declared seed.
   */
  public async playDaily(): Promise<void> {
    // Not while the last match still turns to dust - the reset would end it.
    if (this.resetting() || this.declaring()) {
      return;
    }
    this.gameStateService.leaveOnline();
    // A ranked attempt plays its own day's level, past midnight too.
    const day = this.progress.daily().day;
    if (this.ranked.wants('daily', this.settings.value('ranked'))) {
      const moves = this.stageMoves;
      const attempt = await this.whileDeclaring(() =>
        this.ranked.declareDaily()
      );
      if (this.movedSince(moves)) {
        return;
      }
      this.gameStateService.playDaily(day, attempt);
    } else {
      this.gameStateService.playDaily(day);
    }
    await this.startWhenArenaReady();
  }

  /**
   * On with the endless run after a match: the next match of a ranked run
   * declared first - should that fail, the rest of the run plays unranked.
   * A run that is over starts anew.
   */
  public async continueRun(): Promise<void> {
    const { endless, endlessRanked } = this.store.snapshot();
    if (endless === null || isRunOver(endless)) {
      await this.playEndless();
      return;
    }
    const moves = this.stageMoves;
    const next =
      endlessRanked === null
        ? null
        : await this.whileDeclaring(() =>
            this.ranked.declareRunMatch(endlessRanked)
          );
    if (this.movedSince(moves)) {
      return;
    }
    this.gameStateService.continueEndless(next);
    await this.startWhenArenaReady();
  }

  /** Starts a match on the furthest level the campaign ladder has opened. */
  public continueCampaign(): void {
    this.startOnTap(() => this.playFurthestLevel());
  }

  /** The campaign's next match, on the furthest level open, at once. */
  public playFurthestLevel(): void {
    this.gameStateService.leaveOnline();
    this.gameStateService.setMode('vs-computer');
    this.gameStateService.setLevel(this.campaign.furthestLevel());
    this.startGame();
  }

  /** Starts a match against the ghost of the run someone shared. */
  public fightChallenge(): void {
    const run = this.store.challenge();
    if (run === null || this.resetting()) {
      return;
    }
    this.startOnTap(() => {
      // A reset may have begun in the frame the spinner took.
      if (this.resetting()) {
        return;
      }
      this.dismissChallenge();
      this.gameStateService.leaveOnline();
      this.gameStateService.playGhost(run);
      this.startGame();
    });
  }

  public dismissChallenge(): void {
    this.store.update({ challenge: null });
  }

  /**
   * The ranked match's way out, which has no pause menu: the first tap
   * arms it for a few seconds, the second gives the match up - its
   * attempt then counts as played.
   */
  public giveUp(): void {
    if (this.giveUpTap.tap(true)) {
      this.quitToMenu();
    }
  }

  /** Gives the match up and returns to the main menu. */
  public quitToMenu(): void {
    this.screen.set('menu');
    this.gameStateService.endSeries();
    this.resetGame();
  }

  /**
   * Clears the arena and starts a fresh match. The tap on Start is the one
   * gesture nearly every session makes, so it also takes the screen.
   */
  public startGame(): void {
    this.stageMoves++;
    // A match started from the level choice backs out to the main menu.
    this.screen.set('menu');
    // A first tap on "Give up" in the match before does not carry over.
    this.giveUpTap.disarm();
    this.stageFullscreen.requestNative();
    this.sound.matchStart(levelMusic(this.hud.level().id));
    this.haptics.matchStart();
    this.stageFrame.newMatch();
    this.gameStateService.startMatch(this.arenaStage.arena());
  }

  /** Toggles pause - the touch equivalent of the P key. */
  public togglePause(): void {
    // A ranked match plays through: the music too.
    if (!this.hud.paused() && !this.hud.canPause()) {
      return;
    }
    this.stageFullscreen.requestNative();
    if (this.hud.paused()) {
      this.sound.resume();
    } else {
      this.sound.pause();
    }
    this.haptics.tap();
    this.gameStateService.togglePause();
  }

  /**
   * Pauses, vaporizes the canvas and returns to the start screen - giving
   * an online match up, which the other device then wins.
   */
  public resetGame(): void {
    this.gameStateService.leaveOnline();
    this.resetGame$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /**
   * Pauses, vaporizes the canvas and returns to the start screen, completing
   * once the arena is clear again.
   *
   * The animation is allowed to finish without emitting - what matters is that
   * it is over, so the reset hangs off the completion rather than off a value.
   * An effect that fails - even at once, while `ArenaStage.vaporize` sets it up -
   * is over too: the error is logged here and the reset goes on, so
   * `resetting` never sticks.
   */
  public resetGame$(): Observable<void> {
    return defer(() => {
      this.stageMoves++;
      this.resetting.set(true);
      this.gameStateService.pause();
      return this.arenaStage.vaporize();
    }).pipe(
      catchError((error: unknown) => {
        console.error('The arena could not be vaporized', error);
        return of(undefined);
      }),
      defaultIfEmpty(undefined),
      last(),
      tap(() => {
        // The effect has just faded the container back in.
        this.arenaStage.hideUntilPainted();
        try {
          this.gameStateService.reset();
        } finally {
          // Whatever the reset came to (a GPU simulation may fail to set
          // up again), the stage gets its menu back and what waited for the
          // clear arena goes on; the error goes on. The signal first, so
          // the change detection it schedules is registered before the
          // repaint's animation frame.
          this.resetting.set(false);
          afterNextRender(() => this.arenaStage.stageRenderedAfterReset(), {
            injector: this.injector,
          });
          this.arenaStage.draw();
          this.cleared.next();
        }
      }),
      map(() => undefined)
    );
  }

  /**
   * True when another match started or a reset began since the stage stood
   * at `moves` - or a match is on or being reset now: a start that waited
   * is void then, rather than ending or replacing that match.
   */
  private movedSince(moves: number): boolean {
    return this.stageMoves !== moves || this.hud.running() || this.resetting();
  }

  /** What `declare` comes to, with the declaring note up meanwhile. */
  private async whileDeclaring<T>(declare: () => Promise<T>): Promise<T> {
    this.declaring.set(true);
    try {
      return await declare();
    } finally {
      this.declaring.set(false);
    }
  }

  /**
   * Starts the match once the arena is laid out for it: a ranked match
   * plays the online grid, whose canvas the arena view builds a moment
   * after the grid changed. Waits a little at most, and starts nothing
   * when another match started meanwhile.
   */
  private async startWhenArenaReady(): Promise<void> {
    const moves = this.stageMoves;
    await this.arenaStage.whenReady();
    if (this.movedSince(moves)) {
      return;
    }
    this.startGame();
  }

  /**
   * Starts a match from a tap: the stage takes the screen on the tap
   * itself, the one moment every browser allows it, and the match is set
   * up behind the busy spinner (`StageBusy`), until it runs.
   */
  private startOnTap(start: () => void | Promise<void>): void {
    // A tap while busy is dropped, and takes no screen either.
    if (this.busy.active()) {
      return;
    }
    this.stageFullscreen.requestNative();
    this.busy.run(start);
  }
}
