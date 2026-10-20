import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  Signal,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WsThanosDirective } from '@wolsok/thanos';
import { GhostChallengeComponent } from './ghost/ghost-challenge.component';
import { DAILY_ATTEMPTS } from './state/daily';
import {
  ElemResizedDirective,
  ResizedEvent,
  ShowFpsComponent,
} from '@wolsok/ui-kit';
import { defer, fromEvent, Observable } from 'rxjs';
import { defaultIfEmpty, last, map, take, tap } from 'rxjs/operators';
import { ArenaFrame, ArenaPainter } from './arena/arena-painter';
import { createArenaPainter } from './arena/create-arena-painter';
import { GlArenaPainter } from './arena/gl/gl-arena-painter';
import { ArenaTheme, arenaTheme, cssTriple } from './arena/arena-theme';
import { rgba } from './arena/canvas-math';
import { BoostPadComponent } from './boost-pad/boost-pad.component';
import {
  exitFullscreen,
  fitInside,
  isFullscreen,
  isFullscreenSupported,
  lockLandscape,
  requestFullscreen,
  Size,
  unlockOrientation,
} from './fullscreen';
import { JoystickComponent } from './joystick/joystick.component';
import {
  ColonyColorsComponent,
  ColorChange,
} from './colony-colors/colony-colors.component';
import { MatchSetupComponent } from './match-setup/match-setup.component';
import { LevelSelectComponent } from './menu/level-select.component';
import { MainMenuComponent } from './menu/main-menu.component';
import { DailyCard } from './menu/menu-cards';
import { HelpComponent } from './menu/help.component';
import { ProfileComponent } from './menu/profile.component';
import { SettingsComponent } from './menu/settings.component';
import { SwarmComponent } from './menu/swarm.component';
import { getColonyColor, pickColor, readableOn } from './state/colony-colors';
import { BotDifficulty, difficultyOption } from './state/bot-controller';
import { GameSettingsService } from './settings.service';
import { ProgressService } from './progress.service';
import { CampaignService } from './campaign.service';
import { dismissSplash } from './splash';
import { HeadStart, rivalryScore, SeriesLength } from './state/rivalry';
import { loadFonts } from './fonts';
import { arenaSize, renderScale, scaleOf } from './state/arena-size';
import { GameHapticsService } from './haptics.service';
import { GameSoundService, Soundtrack } from './sound/game-sound.service';
import { MatchResult } from './state/match-engine';
import { levelMusic } from './sound/level-music';
import { arenaPointFromClient, nearestFreeCrosshair } from './touch-controls';
import {
  boostLabel,
  ColonyStats,
  humanForBoostKey,
  sameColonyStats,
  toColonyStats,
} from './colony-stats';
import { GameBalance } from './state/game-balance';
import { GameFrame } from './state/fixed-tick';
import { SteeringVector } from './state/geometry';
import { GameStateService } from './state/game-state.service';
import { GameMode, GameState, GameStateStore } from './state/game.states';
import {
  getLevel,
  Level,
  LEVELS,
  levelBalance,
  levelMap,
  nextLevel,
} from './state/levels';
import { Rect } from './state/maps';
import { MedalTier } from './state/medallions';
import { isBoosted, Player } from './state/player.model';
import { PlayerStore } from './state/player.store';
import { PlayerService } from './state/player.service';
import {
  MatchEndAction,
  WinnerComponent,
} from './winner-info/winner.component';

/** The last seconds of a timed level, when its clock turns red. */
const RUNNING_OUT_SEC = 10;

@UntilDestroy()
@Component({
  imports: [
    CommonModule,
    MatCardModule,
    WsThanosDirective,
    MatButtonModule,
    ShowFpsComponent,
    MatToolbarModule,
    MatIconModule,
    MatTooltipModule,
    MatchSetupComponent,
    JoystickComponent,
    BoostPadComponent,
    ElemResizedDirective,
    WinnerComponent,
    SwarmComponent,
    SettingsComponent,
    HelpComponent,
    MainMenuComponent,
    LevelSelectComponent,
    ProfileComponent,
    ColonyColorsComponent,
    GhostChallengeComponent,
  ],
  templateUrl: './bacteria-game.component.html',
  styleUrls: ['./bacteria-game.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacteriaGameComponent implements AfterViewInit, OnDestroy {
  private store = inject(GameStateStore);
  private gameStateService = inject(GameStateService);
  private playerService = inject(PlayerService);
  private playerStore = inject(PlayerStore);
  protected readonly settings = inject(GameSettingsService);
  protected readonly sound = inject(GameSoundService);
  private readonly haptics = inject(GameHapticsService);
  protected readonly progress = inject(ProgressService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  /** No flickering glow for players who asked their system for less motion. */
  private readonly reducedMotion = prefersReducedMotion();

  /**
   * The canvas the arena is drawn on. A new resolution gets a new canvas -
   * see {@link canvasKey} - which is when the painter is built again.
   */
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');
  @ViewChild('arenaStage', { static: true })
  private stageRef!: ElementRef<HTMLElement>;
  @ViewChild(WsThanosDirective, { static: true })
  private thanos!: WsThanosDirective;
  /** Draws the arena - on the GPU where the browser can. */
  private painter: ArenaPainter | null = null;
  /** Lay the next frame's floor down fully instead of fading into a trail. */
  private clearNextFrame = true;

  /** The arena in cells, as fine as the simulation resolution asks for. */
  protected readonly arena = computed(() =>
    arenaSize(this.settings.simResolution())
  );
  /**
   * One key per pair of resolutions: the canvas is rendered for the key, so
   * either resolution changing hands the painter a fresh canvas and context.
   */
  protected readonly canvasKey = computed(() => [
    `${this.settings.simResolution()}:${this.settings.screenResolution()}`,
  ]);

  stats: Signal<ColonyStats[]>;
  /** The colonies a finger may steer - one seat each in the touch layout. */
  protected readonly humanStats: Signal<ColonyStats[]>;
  protected readonly fps = this.store.fps;
  /** True while a match is on, paused or not. */
  protected readonly running: Signal<boolean>;
  protected readonly paused: Signal<boolean>;
  /**
   * What the match clock shows, in whole seconds so it only re-renders once
   * a second: the time left on a timed level, else the time played.
   */
  protected readonly clockSeconds: Signal<number>;
  /** True on a timed level, where the clock counts down. */
  protected readonly countingDown: Signal<boolean>;
  /** True in the last seconds of a timed level. */
  protected readonly timeRunningOut: Signal<boolean>;
  /** True once a match is over and its result is shown, until the next one. */
  protected readonly matchOver: Signal<boolean>;
  /** The name of the computer's difficulty, for the menu's summary line. */
  protected readonly difficultyName: Signal<string>;
  protected readonly boostLabel = boostLabel;

  /**
   * Which of the menu screens is open while no match runs - and, while one
   * is paused, whether the settings are open on top of the pause menu.
   */
  protected readonly screen = signal<MenuScreen>('menu');
  /**
   * True while the arena is being cleared after a match: the state passes
   * through "paused" then, which is not a pause the player asked for.
   */
  private readonly resetting = signal(false);
  /**
   * What plays underneath: the level's music while the match is on, the
   * menu's between matches while the game fills the stage, and nothing
   * on the pause menu and at the end of a match.
   */
  private readonly soundtrack = computed<Soundtrack | null>(() => {
    if (this.running() && !this.paused()) {
      return levelMusic(this.level().id);
    }
    const inMenu =
      this.fullscreen() &&
      !this.running() &&
      !this.matchOver() &&
      !this.resetting();
    return inMenu ? 'menu' : null;
  });
  /**
   * The panel laid over the arena: the match result, the pause menu, one of
   * the menu screens - or none, while a match is on.
   */
  protected readonly panel = computed<StagePanel>(() => {
    if (this.resetting()) {
      return null;
    }
    if (this.matchOver()) {
      return 'over';
    }
    if (this.paused()) {
      return this.screen() === 'settings' ? 'settings' : 'pause';
    }
    return this.running() ? null : this.screen();
  });
  /**
   * True while a menu screen fills the stage: what lies under it - the
   * arena, its bar and the seats - is out of reach then.
   */
  protected readonly screenOpen = computed(() => {
    const panel = this.panel();
    return (
      this.fullscreen() &&
      panel !== null &&
      panel !== 'pause' &&
      panel !== 'over'
    );
  });
  /** True while the browser shows the stage on the whole screen. */
  protected readonly nativeFullscreen = signal(false);
  /** False where the browser has no Fullscreen API, as on iPhones. */
  protected readonly nativeFullscreenSupported = signal(false);
  /** False where the device cannot vibrate - the setting is left out then. */
  protected readonly vibrationSupported = this.haptics.supported;

  /** The level the next match is played on. */
  protected readonly level: Signal<Level>;
  /** Balance of the selected level - drives both rendering and the scoreboard. */
  protected readonly balance: Signal<GameBalance>;
  /** Walls of the selected level, drawn every frame. */
  protected readonly walls: Signal<Rect[]>;
  /** How the selected level looks and sounds. */
  protected readonly theme: Signal<ArenaTheme>;
  /** The frame colour of the arena, as a CSS `rgb()` triple. */
  protected readonly arenaBorder: Signal<string>;
  /** The darkest floor colour of the arena, for the stage around it. */
  protected readonly arenaRim: Signal<string>;
  /** Seconds of animation, for the wobble of the jam and the boost shimmer. */
  private animationSec = 0;
  /** True while a still frame waits for its animation frame. */
  private repaintPending = false;
  /** The level that follows the selected one, null at the end of the list. */
  protected readonly upcomingLevel: Signal<Level | null>;
  /** The level of a run someone shared in a link, null without one. */
  protected readonly challengeLevel = computed(() => {
    const run = this.store.challenge();
    return run === null ? null : getLevel(run.header.levelId);
  });
  /** Two humans or one human against the computer. */
  protected readonly mode: Signal<GameMode>;
  /** How hard the computer plays. */
  protected readonly difficulty: Signal<BotDifficulty>;
  /** The colour ids of the left and the right colony. */
  protected readonly colors: Signal<[string, string]>;
  /** The names of the left and the right colour, for the help texts. */
  protected readonly colorNames = computed((): [string, string] => {
    const [left, right] = this.colors();
    return [getColonyColor(left).name, getColonyColor(right).name];
  });
  /** The best medallion of every level at the selected difficulty. */
  protected readonly levelMedals = computed(() => {
    const difficulty = this.difficulty();
    return Object.fromEntries(
      LEVELS.map((level): [string, MedalTier | null] => [
        level.id,
        this.progress.medal(level.id, difficulty),
      ])
    );
  });
  /** Why each level is still locked on the campaign ladder, by level id. */
  protected readonly campaign = inject(CampaignService);
  protected readonly lockedLevels = this.campaign.locks;
  /** Between two players: the series length, the head start, the series. */
  protected readonly seriesLength = this.store.seriesLength;
  protected readonly headStart = this.store.headStart;
  /** The lifetime wins of the two colours between two players. */
  protected readonly rivalry = computed(() =>
    rivalryScore(this.progress.couchWins(), this.colors())
  );
  /** Every medallion held, by level id, then by difficulty. */
  protected readonly medals = this.progress.medals;
  protected readonly achievements = this.progress.achievements;
  protected readonly totals = this.progress.totals;
  protected readonly xp = this.progress.xp;
  protected readonly colorLocks = this.progress.colorLocks;
  protected readonly arenaLocks = this.progress.arenaLocks;
  /**
   * The colony colours as RGB and as CSS, with a text colour that reads on
   * the player's - for the menu screens.
   */
  protected readonly colonyRgb = computed(
    () =>
      this.colors().map((id) => getColonyColor(id).rgb) as [
        readonly [number, number, number],
        readonly [number, number, number],
      ]
  );
  protected readonly colonyCss = computed(() =>
    this.colonyRgb().map((rgb) => rgba(rgb))
  );
  protected readonly onPlayerColor = computed(() =>
    readableOn(this.colonyRgb()[0])
  );
  /** Why the level after the selected one is locked, null when it is open. */
  protected readonly upcomingLock = computed(() => {
    const upcoming = this.upcomingLevel();
    return upcoming === null
      ? null
      : (this.lockedLevels()[upcoming.id] ?? null);
  });
  /** The crosshairs a finger or a key may steer - never the computer's. */
  private readonly humans: Signal<Player[]>;

  /**
   * True while the arena fills the screen: the touch layout with a seat per
   * player, laid over the whole viewport. The page opens this way - a phone
   * between two players has no room for a page around the game.
   *
   * This is the component's own layout and works everywhere. On top of it the
   * browser's Fullscreen API is used where it exists, to hide the browser
   * chrome as well - see {@link requestNativeFullscreen}.
   */
  protected readonly fullscreen = signal(true);
  /** The box around the canvas in CSS pixels, null before its first layout. */
  private readonly arenaBoxSize = signal<Size | null>(null);
  /**
   * Explicit canvas size while fullscreen: the largest box with the arena's
   * aspect ratio that fits the box around it. Null while the normal layout
   * sizes the canvas by CSS.
   *
   * Letting CSS scale the drawing inside a bigger element would work visually,
   * but the pointer maths maps a touch through the bounding rect of the canvas
   * - padding hidden in that rect would offset every crosshair drag.
   */
  protected readonly canvasSize = computed(() => {
    const box = this.arenaBoxSize();
    // Leave room for the glowing frame around the arena.
    const frame = 2 * ARENA_FRAME_PX;
    return this.fullscreen() && box != null
      ? fitInside(
          Math.max(0, box.width - frame),
          Math.max(0, box.height - frame),
          this.arena().width,
          this.arena().height
        )
      : null;
  });

  /** Which crosshair each active pointer is dragging: pointerId -> playerId. */
  private readonly draggedBy = new Map<number, number>();

  constructor() {
    loadFonts(document);
    this.gameStateService.reset();
    // A series lasts for a visit of the page: one left unfinished last time
    // does not carry over.
    this.gameStateService.endSeries();

    this.level = this.store.level;
    this.balance = computed(() =>
      levelBalance(this.level(), scaleOf(this.arena().width))
    );
    this.walls = computed(() => {
      const { width, height } = this.arena();
      return levelMap(this.level()).createWalls(width, height);
    });
    this.upcomingLevel = computed(() => nextLevel(this.level().id));
    void this.takeChallenge();
    this.theme = computed(() =>
      arenaTheme(this.campaign.activeArena() ?? this.level().id)
    );
    this.arenaBorder = computed(() => cssTriple(this.theme().border));
    this.arenaRim = computed(() => cssTriple(this.theme().rim));

    this.mode = this.store.mode;
    this.colors = this.store.colors;
    this.difficulty = this.store.difficulty;

    const players = this.playerStore.entities;
    this.humans = computed(() => players().filter((player) => !player.isBot));
    // The crosshairs move the players every frame - the scoreboard only
    // renders again once one of its numbers changes.
    this.stats = computed(() => toColonyStats(players(), this.balance()), {
      equal: sameColonyStats,
    });
    this.humanStats = computed(() =>
      this.stats().filter((colony) => !colony.isBot)
    );

    // Repaint as soon as another level puts different walls into the arena, or
    // the colonies change colour or look, so the start screen always shows
    // the map and the colonies the next match is fought with. A clear frame
    // also wipes the glow from the trail once the player asks for less
    // motion, even while the game is paused.
    effect(() => {
      this.painter?.setTheme(this.theme());
      this.walls();
      this.colors();
      this.settings.look();
      this.reducedMotion();
      this.draw();
    });

    // A fresh canvas - the first one, or one for another resolution - gets a
    // painter of its own.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas != null) {
        untracked(() => this.attachPainter(canvas));
      }
    });

    this.running = this.store.isMatchOn;
    this.paused = this.store.isPaused;
    this.clockSeconds = computed(
      () => this.store.secondsLeft() ?? this.store.gameSeconds()
    );
    this.countingDown = computed(() => this.store.secondsLeft() !== null);
    this.timeRunningOut = computed(
      () => (this.store.secondsLeft() ?? Infinity) <= RUNNING_OUT_SEC
    );
    this.matchOver = this.store.matchEnded;
    // A resumed match picks its music up where the match clock stands, so
    // it stays in step with a map that moves to it.
    effect(() => {
      const music = this.soundtrack();
      untracked(() =>
        this.sound.setMusic(music, this.store.snapshot().timePassed / 1000)
      );
    });
    effect(() => {
      if (this.matchOver()) {
        untracked(() => this.finishMatch());
      }
    });

    this.difficultyName = computed(
      () => difficultyOption(this.difficulty())?.name ?? ''
    );

    this.gameStateService.frames$
      .pipe(untilDestroyed(this))
      .subscribe((frame) => this.runFrame(frame));
  }

  /**
   * Takes the run a link carries in its hash as a challenge, and takes it
   * out of the address, so a reload or a bookmark does not offer it again.
   */
  private async takeChallenge(): Promise<void> {
    if (
      !(await this.gameStateService.offerChallenge(this.document.location.hash))
    ) {
      return;
    }
    // Through the router, so it does not keep the run in the url it holds.
    await this.router.navigateByUrl(this.router.url.split('#')[0], {
      replaceUrl: true,
    });
  }

  /** Today's daily level for the main menu. */
  protected readonly dailyCard = computed((): DailyCard => {
    const { levelId, attemptsLeft, streak } = this.progress.daily();
    const attempts =
      attemptsLeft > 0
        ? `${attemptsLeft} of ${DAILY_ATTEMPTS} attempts left`
        : 'Attempts used - practice until 00:00 UTC';
    return {
      name: getLevel(levelId).name,
      note: streak > 0 ? `${attempts} · ${streak}-day streak` : attempts,
    };
  });

  /** True in a match of an endless run - no restart, it would cost no life. */
  protected readonly inEndlessRun = this.store.endlessMatch;

  /** Starts a new endless run, on its first level. */
  protected playEndless(): void {
    if (this.resetting()) {
      return;
    }
    this.gameStateService.startEndless();
    this.startGame();
  }

  /** Starts a match on today's daily level, against the computer. */
  protected playDaily(): void {
    // Not while the last match still turns to dust - the reset would end it.
    if (this.resetting()) {
      return;
    }
    this.gameStateService.playDaily(this.progress.daily().day);
    this.startGame();
  }

  /** Starts a match against the ghost of the run someone shared. */
  protected fightChallenge(): void {
    const run = this.store.challenge();
    if (run === null || this.resetting()) {
      return;
    }
    this.dismissChallenge();
    this.gameStateService.playGhost(run);
    this.startGame();
  }

  protected dismissChallenge(): void {
    this.store.update({ challenge: null });
  }

  /**
   * Clears the arena after a match and, unless the player heads back to the
   * menu, kicks off the next one right away - on the following level for
   * "next level".
   */
  protected onMatchEnd(action: MatchEndAction): void {
    if (action === 'next' && this.upcomingLock() !== null) {
      return;
    }
    const next = action === 'next' ? this.upcomingLevel() : null;
    // The reset ends a match set outside the setup: a rematch sets it again.
    const rematch =
      action === 'again' ? this.gameStateService.oneMatch() : null;
    this.screen.set(action === 'levels' ? 'levels' : 'menu');
    if (action === 'menu') {
      this.gameStateService.endSeries();
    }
    this.resetGame$()
      .pipe(
        tap(() => {
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
            this.gameStateService.advanceEndless();
          }
          if (
            action === 'again' ||
            action === 'next' ||
            action === 'ghost' ||
            action === 'endless'
          ) {
            this.startGame();
          }
        }),
        untilDestroyed(this)
      )
      .subscribe();
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

  /** Turns the sound on or off - with a tick to show it is on. */
  protected setSound(on: boolean): void {
    this.settings.setSound(on);
    if (on) {
      this.sound.tick();
    }
  }

  /** Turns the sound effects on or off - with a tick to show they are on. */
  protected setEffects(on: boolean): void {
    this.settings.setEffects(on);
    if (on) {
      this.sound.tick();
    }
  }

  /** Turns the vibration on or off - with a buzz to show it is on. */
  protected setVibration(on: boolean): void {
    this.settings.setVibration(on);
    if (on) {
      this.haptics.tap();
    } else {
      this.haptics.stop();
    }
  }

  /** Opens one of the menu screens. */
  protected show(screen: MenuScreen): void {
    if (screen !== this.screen()) {
      this.sound.navigate();
    }
    this.screen.set(screen);
  }

  protected selectSeriesLength(length: SeriesLength): void {
    this.gameStateService.setSeriesLength(length);
  }

  protected selectHeadStart(headStart: HeadStart): void {
    this.gameStateService.setHeadStart(headStart);
  }

  /** Sets a match up against the computer or between two players. */
  protected chooseLevel(mode: GameMode): void {
    this.selectMode(mode);
    this.show('levels');
  }

  /** Starts a match on the furthest level the campaign ladder has opened. */
  protected continueCampaign(): void {
    this.selectMode('vs-computer');
    this.gameStateService.setLevel(this.campaign.furthestLevel());
    this.startGame();
  }

  /** Gives the match up and returns to the main menu. */
  protected quitToMenu(): void {
    this.screen.set('menu');
    this.gameStateService.endSeries();
    this.resetGame();
  }

  /** Puts the stage on the browser's whole screen, or takes it off again. */
  protected setNativeFullscreen(on: boolean): void {
    if (on) {
      this.requestNativeFullscreen();
    } else {
      exitFullscreen(document);
    }
  }

  ngAfterViewInit(): void {
    dismissSplash(document);
    this.nativeFullscreenSupported.set(
      isFullscreenSupported(document, this.stageRef?.nativeElement)
    );
    this.requestNativeFullscreenOnOpen();
  }

  /**
   * Builds the painter for a fresh canvas, at the resolutions it was rendered
   * for, and lets go of the one before. Resolutions only change between
   * matches, so the colonies are simply spawned again on the new grid.
   */
  private attachPainter(canvas: HTMLCanvasElement): void {
    // The GPU simulation lives in the old context: let it go while it lasts.
    this.playerService.useSimulation(null);
    this.painter?.dispose();
    this.painter = null;
    const { width, height } = this.arena();
    this.painter = createArenaPainter(
      canvas,
      width,
      height,
      renderScale(
        this.settings.simResolution(),
        this.settings.screenResolution()
      )
    );
    if (this.painter == null) {
      throw new Error('Could not get rendering context');
    }
    // Which painter runs - for the e2e tests and for anyone debugging.
    canvas.dataset['renderer'] = this.painter.kind;
    // With a WebGL2 context the war itself runs on the GPU as well.
    const gl = this.painter instanceof GlArenaPainter ? this.painter : null;
    this.playerService.useSimulation(
      gl == null
        ? null
        : (balance, random) => gl.createSimulation(balance, random)
    );
    this.painter.setTheme(this.theme());
    this.gameStateService.setArenaSize(width, height);
    this.draw();
  }

  /**
   * Clears the arena and starts a fresh match. The tap on Start is the one
   * gesture nearly every session makes, so it also takes the screen.
   */
  startGame() {
    // A match started from the level choice backs out to the main menu.
    this.screen.set('menu');
    this.requestNativeFullscreen();
    this.sound.matchStart(levelMusic(this.level().id));
    this.haptics.matchStart();
    this.clearNextFrame = true;
    this.gameStateService.cleanup();
    this.gameStateService.init(this.arena().width, this.arena().height);
    this.gameStateService.start();
  }

  private vaporize(): Observable<void> {
    // The effect takes its snapshot of the canvas right away.
    this.painter?.showLastFrame();
    return this.thanos.vaporize(false).pipe(take(1));
  }

  /** Pauses, vaporizes the canvas and returns to the start screen. */
  resetGame() {
    this.resetGame$().pipe(untilDestroyed(this)).subscribe();
  }

  /**
   * Pauses, vaporizes the canvas and returns to the start screen, completing
   * once the arena is clear again.
   *
   * The animation is allowed to finish without emitting - what matters is that
   * it is over, so the reset hangs off the completion rather than off a value.
   */
  private resetGame$(): Observable<void> {
    return defer(() => {
      this.resetting.set(true);
      this.gameStateService.pause();
      return this.vaporize().pipe(
        defaultIfEmpty(undefined),
        last(),
        tap(() => {
          this.gameStateService.reset();
          this.draw();
          this.resetting.set(false);
        }),
        map(() => undefined)
      );
    });
  }

  /**
   * Advances the war by the frame's ticks and paints it - called by the game
   * loop, inside the animation frame, so what is painted is shown on that
   * frame.
   */
  private runFrame(frame: GameFrame): void {
    if (this.painter == null) {
      return;
    }
    const { width, height } = this.arena();
    this.gameStateService.advance(width, height, frame.ticks);
    const events = this.playerService.getFrameEvents();
    this.sound.frame(events);
    this.haptics.frame(events);
    this.paint(frame.elapsedSec, false, frame.alpha);
  }

  /**
   * Paints the arena as it stands, on the next animation frame, without
   * advancing the war - whenever it changes while nobody is playing. The
   * frame is cleared: the fade alone would leave the walls of the last map
   * as ghosts on the canvas.
   */
  private draw(): void {
    if (this.painter == null || this.repaintPending) {
      return;
    }
    this.repaintPending = true;
    requestAnimationFrame(() => {
      this.repaintPending = false;
      this.paint(1 / 1000, true, 1);
    });
  }

  /** `alpha` is how far the crosshairs are drawn along their last tick. */
  private paint(deltaTimeSec: number, clear: boolean, alpha: number): void {
    this.animationSec += deltaTimeSec;
    const frame = this.frame(deltaTimeSec, clear || this.clearNextFrame, alpha);
    this.clearNextFrame = false;
    this.painter?.paint(frame);
  }

  /** What the arena shows right now, for the painter. */
  private frame(
    deltaTimeSec: number,
    clear: boolean,
    alpha: number
  ): ArenaFrame {
    const balance = this.balance();
    const players = untracked(this.playerStore.entities);
    const drawn = players.map((player) => ({
      player,
      at: this.playerService.crosshairAt(player, alpha),
    }));
    const boosts = new Map(
      drawn
        .filter(({ player }) => isBoosted(player))
        .map(({ player, at }) => [player.id, at])
    );
    const simulation = this.playerService.getSimulation();
    // Which processor runs the war - for the e2e tests and for debugging.
    // The match picks it, so it can fall back to the CPU after a GPU error.
    const dataset = this.canvasRef()?.nativeElement.dataset;
    if (dataset != null && dataset['simulation'] !== simulation.kind) {
      dataset['simulation'] = simulation.kind;
    }
    return {
      clear,
      deltaTimeSec,
      timeSec: this.animationSec,
      walls: this.walls(),
      dynamicWalls: this.playerService.getDynamicWalls(),
      colonies: simulation.colonyLayers(boosts),
      reducedMotion: this.reducedMotion(),
      nutrients: this.playerService.getNutrients(),
      balance,
      look: this.settings.look(),
      cursors: drawn.map(({ player, at }) => ({
        ...at,
        color: player.color,
        boostLeft:
          isBoosted(player) && balance.boostDurationSec > 0
            ? player.boostActiveSec / balance.boostDurationSec
            : null,
      })),
    };
  }

  ngOnDestroy(): void {
    this.gameStateService.endSeries();
    this.gameStateService.cleanup();
    // The GPU simulation lives in this canvas's context, which goes with it.
    this.playerService.useSimulation(null);
    this.painter?.dispose();
    this.sound.setMusic(null);
    // Leaving the page must give the screen back as well.
    exitFullscreen(document);
    unlockOrientation(screen);
  }

  /** Toggles pause - the touch equivalent of the P key. */
  togglePause() {
    this.requestNativeFullscreen();
    if (this.paused()) {
      this.sound.resume();
    } else {
      this.sound.pause();
    }
    this.haptics.tap();
    this.gameStateService.togglePause();
  }

  /** Picks the level the next match is played on - one the ladder opened. */
  protected selectLevel(levelId: string): void {
    this.gameStateService.setLevel(levelId);
  }

  /** Switches between two humans and human versus computer. */
  protected selectMode(mode: GameMode): void {
    this.gameStateService.setMode(mode);
  }

  /** Gives a seat's colony another colour. */
  protected selectColor(change: ColorChange): void {
    // Neither seat may end up with a colour still to earn - a swap would
    // hand the other seat one just as well. A colour a seat has, it keeps.
    const colors = this.colors();
    const next = pickColor(colors, change.seat, change.colorId);
    const locks = this.colorLocks();
    if (next.some((id, seat) => id !== colors[seat] && id in locks)) {
      return;
    }
    this.gameStateService.setColor(change.seat, change.colorId);
  }

  /** Picks how hard the computer plays. */
  protected selectDifficulty(difficulty: BotDifficulty): void {
    this.gameStateService.setDifficulty(difficulty);
  }

  /** Fires a player's boost - the button equivalent of Space / Enter. */
  protected boost(playerId: number): void {
    this.gameStateService.boost(playerId);
  }

  /** Pushes or releases a player's on-screen joystick. */
  protected steer(playerId: number, vector: SteeringVector): void {
    this.playerService.setSteering(playerId, vector);
  }

  /**
   * Lays the arena over the whole viewport and asks the browser for its
   * fullscreen on top. Called from a gesture - the button or the F key -
   * where the browser grants the request.
   */
  protected enterFullscreen(): void {
    this.fullscreen.set(true);
    this.requestNativeFullscreen();
  }

  /**
   * The page opens in the layout already (see {@link fullscreen}); this asks
   * for the browser's fullscreen on top. Without a gesture to spend the
   * browser would refuse and log an error, so the request is only made while
   * one is still fresh - after a navigation started by a click - and otherwise
   * left to the next gesture the game owns: Start, resume, F or the button.
   */
  private requestNativeFullscreenOnOpen(): void {
    if (navigator.userActivation?.isActive) {
      this.requestNativeFullscreen();
    }
  }

  /** Brings the arena back into the page. */
  protected leaveFullscreen(): void {
    this.fullscreen.set(false);
    exitFullscreen(document);
  }

  /**
   * Asks the browser to put the stage on the whole screen, once a request
   * stands a chance: only while the layout is up, not without the API, and
   * not while the stage is on the screen already. A refusal costs nothing -
   * the next gesture asks again.
   */
  private requestNativeFullscreen(): void {
    const stage = this.stageRef?.nativeElement;
    if (
      !this.fullscreen() ||
      !isFullscreenSupported(document, stage) ||
      this.isNativeFullscreen()
    ) {
      return;
    }
    void requestFullscreen(stage);
  }

  /** True while the browser shows the stage, and nothing else, on the screen. */
  private isNativeFullscreen(): boolean {
    return isFullscreen(document, this.stageRef?.nativeElement ?? undefined);
  }

  /**
   * Follows the browser both ways. Once it puts the stage on the screen, the
   * layout is up as well: a request granted late, after the layout was left,
   * must not leave a bare stage on the screen. Native fullscreen also locks
   * a phone into landscape, where the arena and the two seats fit.
   *
   * Once it takes the stage off - Escape, the back gesture, a system dialog,
   * the settings toggle - the game reacts as it does to Escape, which the
   * browser consumes before it reaches {@link onKeyDown}: a running match
   * pauses, a screen stays open, and only the main menu leaves for the page.
   */
  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  protected onFullscreenChange(): void {
    const native = this.isNativeFullscreen();
    this.nativeFullscreen.set(native);
    if (native) {
      this.fullscreen.set(true);
      void lockLandscape(screen);
      return;
    }
    unlockOrientation(screen);
    if (this.running() && !this.paused()) {
      this.gameStateService.togglePause();
    } else if (this.panel() === 'menu') {
      this.leaveFullscreen();
    }
  }

  /**
   * Remembers the size of the box around the canvas, which the touch layout
   * fits the canvas into - see {@link canvasSize}.
   */
  protected onArenaBoxResized(event: ResizedEvent): void {
    this.arenaBoxSize.set({ width: event.newWidth, height: event.newHeight });
  }

  /**
   * Grabs the crosshair nearest to the touch and starts dragging it.
   *
   * Two pointers can be active at once, one per player, so both can play on the
   * same screen.
   */
  onPointerDown(event: PointerEvent) {
    const point = this.toArenaPoint(event);
    if (point == null) {
      return;
    }
    const playerId = nearestFreeCrosshair(
      this.humans(),
      point,
      new Set(this.draggedBy.values())
    );
    if (playerId == null) {
      return;
    }
    this.draggedBy.set(event.pointerId, playerId);
    // Keep receiving moves once the finger slides off the canvas.
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.playerService.setDragTarget(playerId, point.x, point.y);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent) {
    const playerId = this.draggedBy.get(event.pointerId);
    if (playerId == null) {
      return;
    }
    const point = this.toArenaPoint(event);
    if (point == null) {
      return;
    }
    this.playerService.setDragTarget(playerId, point.x, point.y);
    event.preventDefault();
  }

  /**
   * Releases the crosshair so another finger can grab it. The target itself
   * stays, so the crosshair finishes travelling to where the finger left it.
   */
  onPointerUp(event: PointerEvent) {
    this.draggedBy.delete(event.pointerId);
  }

  private toArenaPoint(event: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas == null) {
      return null;
    }
    return arenaPointFromClient(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      this.arena().width,
      this.arena().height
    );
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown($event: KeyboardEvent) {
    if (isTypingTarget($event.target)) {
      return;
    }
    // F is handled here rather than in the store: the fullscreen request has
    // to happen inside the key event, browsers reject it otherwise.
    if ($event.key.toLowerCase() === 'f' && !$event.repeat) {
      if (this.fullscreen()) {
        this.leaveFullscreen();
      } else {
        this.enterFullscreen();
      }
      return;
    }
    // Escape, as in any game: pauses a match, backs out of a screen, and
    // only from the main menu leaves the layout for the page. The browser
    // takes its own fullscreen off on Escape before this runs.
    if ($event.key === 'Escape') {
      this.onEscape();
      return;
    }
    // The boost keys belong to the game only while a match is on, and never
    // while a button has the focus: a keyboard user pressing Enter on "Reset"
    // expects a reset, not a boost. Outside of a match Space still scrolls.
    const boosted =
      this.store.snapshot().currentState === GameState.RUNNING &&
      !isInteractiveTarget($event.target)
        ? humanForBoostKey(this.humans(), $event.key)
        : null;
    if (boosted != null) {
      // Space would scroll the page.
      $event.preventDefault();
      if (!$event.repeat) {
        this.boost(boosted.id);
      }
      return;
    }
    this.gameStateService.addKeyPress($event.key);
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp($event: KeyboardEvent) {
    this.gameStateService.removeKeyPress($event.key);
  }

  private onEscape(): void {
    if (this.matchOver() || this.resetting()) {
      return;
    }
    if (this.running() && !this.paused()) {
      this.togglePause();
    } else if (this.screen() !== 'menu') {
      this.screen.set('menu');
    } else if (this.paused()) {
      this.togglePause();
    } else {
      this.leaveFullscreen();
    }
  }
}

/** Room kept free around the arena for its frame, in CSS pixels. */
const ARENA_FRAME_PX = 6;

/** The screens of the menu that is shown while no match is on. */
export type MenuScreen = 'menu' | 'levels' | 'profile' | 'settings' | 'help';

/** What is laid over the arena right now, nothing while a match is on. */
export type StagePanel = MenuScreen | 'pause' | 'over' | null;

/**
 * True while the key went to a control rather than to the game.
 *
 * Anything inside an overlay counts too: the level picker is a combobox whose
 * panel lives in the CDK overlay container, and typing a level name there must
 * not throw the page into fullscreen.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element == null || typeof element.closest !== 'function') {
    return false;
  }
  return (
    element.isContentEditable ||
    element.closest(
      'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], .cdk-overlay-container'
    ) != null
  );
}

/**
 * True while the key went to a focused control that Space or Enter activates,
 * such as a button or a toggle. A disabled control cannot be activated, so a
 * key pressed on it still belongs to the game - the Start button keeps the
 * focus after it kicked off the match and gets disabled.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element == null || typeof element.closest !== 'function') {
    return false;
  }
  const control = element.closest<HTMLElement>(
    'button, a[href], [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"]'
  );
  if (control == null) {
    return false;
  }
  return !(
    (control as HTMLButtonElement).disabled ||
    control.getAttribute('aria-disabled') === 'true'
  );
}

/** Whether the system asks for less motion - following it as it changes. */
function prefersReducedMotion(): Signal<boolean> {
  if (typeof matchMedia !== 'function') {
    return signal(false);
  }
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  return toSignal(
    fromEvent<MediaQueryListEvent>(query, 'change').pipe(
      map((event) => event.matches)
    ),
    { initialValue: query.matches }
  );
}
