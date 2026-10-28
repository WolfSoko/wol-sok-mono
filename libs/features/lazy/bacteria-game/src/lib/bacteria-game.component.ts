import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  OnDestroy,
  Signal,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WsThanosDirective, WsThanosOptions } from '@wolsok/thanos';
import { TranslationKey } from './i18n/dictionaries';
import { I18nService } from './i18n/i18n.service';
import { difficultyKeys, levelNameText, missionKeys } from './i18n/game-texts';
import { TranslatePipe } from './i18n/translate.pipe';
import { ElemResizedDirective, ResizedEvent } from '@wolsok/ui-kit';
import {
  asapScheduler,
  defer,
  firstValueFrom,
  Observable,
  of,
  timer,
} from 'rxjs';
import {
  defaultIfEmpty,
  filter,
  last,
  map,
  take,
  tap,
  timeout,
} from 'rxjs/operators';
import { DishAmbience } from './arena/ambience';
import { ArenaPainter } from './arena/arena-painter';
import {
  ArenaContent,
  ArenaLayout,
  ArenaScene,
  ArenaViewComponent,
  layoutKey,
} from './arena/arena-view.component';
import { armedTap } from './armed-tap';
import { StageBusyComponent } from './busy/stage-busy.component';
import { StageBusy } from './busy/stage-busy';
import { GlArenaPainter } from './arena/gl/gl-arena-painter';
import type { GpuSelfTestResult } from './gl/gpu-self-test';
import { GpuSelfTestService } from './gl/gpu-self-test.service';
import { SimulationOverrideService } from './gl/simulation-override.service';
import { chooseSimulation } from './gl/simulation-choice';
import { FeatureTogglesService } from './feature-toggles.service';
import { gpuTrusted } from './gl/simulation-check';
import { ArenaTheme, arenaTheme, cssTriple } from './arena/arena-theme';
import { rgba } from './arena/canvas-math';
import { BoostPadComponent } from './boost-pad/boost-pad.component';
import { WeaponPadComponent } from './weapon-pad/weapon-pad.component';
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
import { ColorChange } from './colony-colors/colony-colors.component';
import { NewGameComponent } from './menu/new-game.component';
import { NewGameEntry, opponentOf, PlayKind, stepsOf } from './menu/play-modes';
import { MainMenuComponent } from './menu/main-menu.component';
import { DailyCard } from './menu/menu-cards';
import { FriendsScreenComponent } from './menu/friends-screen.component';
import { LeaderboardsComponent } from './boards/leaderboards.component';
import { ModerationNoticesComponent } from './moderation/moderation-notices.component';
import { ModerationService } from './moderation/moderation.service';
import { RankedService } from './ranked/ranked.service';
import { MyMatchesComponent } from './replays/my-matches.component';
import { ReplayScreenComponent } from './replays/replay-screen.component';
import { HelpComponent } from './menu/help.component';
import { EvolutionComponent } from './menu/evolution.component';
import { ProfileComponent } from './menu/profile.component';
import { MyColonyComponent } from './menu/my-colony.component';
import { SettingsComponent } from './menu/settings.component';
import { prefersReducedMotion } from './reduced-motion';
import { SwarmComponent } from './menu/swarm.component';
import {
  getColonyColor,
  NEUTRAL_COLOR,
  pickColor,
  readableOn,
} from './state/colony-colors';
import { BotDifficulty } from './state/bot-controller';
import { GameSettingsService } from './settings.service';
import { vaporizePixels } from './vaporize-effect';
import { ProgressService } from './progress.service';
import { EvolutionService } from './evolution.service';
import { CampaignService } from './campaign.service';
import { dismissSplash } from './splash';
import { HeadStart, rivalryScore, SeriesLength } from './state/rivalry';
import {
  arenaSize,
  detailScale,
  ONLINE_SIM_RESOLUTION,
  renderScale,
  SimResolution,
  simScale,
} from './state/arena-size';
import { MatchmakerService } from './net/matchmaker.service';
import { OnlineMatchService } from './net/online-match.service';
import {
  InviteOffer,
  SocialNoticesComponent,
} from './social/social-notices.component';
import {
  ChallengeView,
  FriendView,
  SocialService,
} from './social/social.service';
import { arenaContent, SeatColors } from './arena/arena-content';
import { computerLook, seatLooks } from './state/colony-looks';
import { Camera, CameraShake } from './arena/camera';
import { MinimapPainter } from './arena/minimap';
import type { WeaponFire } from './state/evolution';
import { GameHapticsService } from './haptics.service';
import { GameSoundService, Soundtrack } from './sound/game-sound.service';
import { MatchResult } from './state/match-engine';
import { levelMusic } from './sound/level-music';
import {
  arenaPointFromClient,
  clientPoint,
  nearestFreeCrosshair,
  Pinch,
} from './touch-controls';
import {
  ColonyStats,
  humanForBoostKey,
  humanForWeaponKey,
  sameColonyStats,
  toColonyStats,
} from './colony-stats';
import { HudBarComponent, HudGoal } from './hud-bar.component';
import { GameBalance } from './state/game-balance';
import { clock, GameFrame } from './state/fixed-tick';
import { Point, SteeringVector } from './state/geometry';
import { GameStateService } from './state/game-state.service';
import { GameMode, GameState, GameStateStore } from './state/game.states';
import {
  getLevel,
  gridScale,
  Level,
  levelBalance,
  levelMap,
  levelSize,
  ONLINE_LOCKS,
  nextLevel,
} from './state/levels';
import { pickMatchLevel } from './state/match-level';
import { isRunOver } from './state/endless';
import { DynamicWall, Rect } from './state/maps';
import { harvestTarget, holdTarget } from './state/win-conditions';
import { MissionId } from './state/training';
import { mapZones, Zone } from './state/zones';
import { Player } from './state/player.model';
import { PlayerStore } from './state/player.store';
import { PlayerService } from './state/player.service';
import { FramePerf } from './arena/frame-perf';
import { AdaptiveQuality } from './arena/adaptive-quality';
import type { GpuTimer } from './gl/gpu-timer';
import { HudPerf, simulationLabel } from './hud-perf';
import {
  MatchEndAction,
  WinnerComponent,
} from './winner-info/winner.component';

/**
 * The vaporize snap's volume at full effects. The game's effects are short
 * and quiet blips, the snap's wind and sand blow for the whole effect: at
 * this level they sit among the other effects instead of over them.
 */
const SNAP_LEVEL = 0.3;

/** The last seconds of a timed level, when its clock turns red. */
const RUNNING_OUT_SEC = 10;

/** How often the minimap takes in where the colonies are. */
const MINIMAP_UPDATE_MS = 100;

/** A goal the HUD counts each colony up towards. */

@UntilDestroy()
@Component({
  imports: [
    HudBarComponent,
    MatCardModule,
    WsThanosDirective,
    MatButtonModule,
    MatIconModule,
    SocialNoticesComponent,
    ModerationNoticesComponent,
    JoystickComponent,
    BoostPadComponent,
    WeaponPadComponent,
    ElemResizedDirective,
    WinnerComponent,
    SwarmComponent,
    MyColonyComponent,
    SettingsComponent,
    HelpComponent,
    FriendsScreenComponent,
    LeaderboardsComponent,
    MyMatchesComponent,
    ReplayScreenComponent,
    MainMenuComponent,
    NewGameComponent,
    ProfileComponent,
    EvolutionComponent,
    TranslatePipe,
    ArenaViewComponent,
    StageBusyComponent,
  ],
  templateUrl: './bacteria-game.component.html',
  styleUrls: ['./bacteria-game.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The game speaks its own language, whatever the shell around it speaks.
  host: { '[attr.lang]': 'language()' },
})
export class BacteriaGameComponent implements AfterViewInit, OnDestroy {
  private store = inject(GameStateStore);
  private gameStateService = inject(GameStateService);
  private readonly busy = inject(StageBusy);
  private playerService = inject(PlayerService);
  private playerStore = inject(PlayerStore);
  protected readonly settings = inject(GameSettingsService);
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nService);
  protected readonly language = this.i18n.language;
  protected readonly sound = inject(GameSoundService);
  private readonly haptics = inject(GameHapticsService);
  private readonly gpuSelfTest = inject(GpuSelfTestService);
  private readonly simulationOverride = inject(SimulationOverrideService);
  private readonly featureTogglesService = inject(FeatureTogglesService);
  private readonly featureToggles = this.featureTogglesService.toggles;
  protected readonly progress = inject(ProgressService);
  protected readonly evolution = inject(EvolutionService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly online = inject(OnlineMatchService);
  private readonly matchmaker = inject(MatchmakerService);
  /** The lobby of an online match, for the new game's start. */
  protected readonly onlineLobby = this.online.lobby;
  protected readonly onlineAvailable = this.online.available;
  /** True while this device is connected to an online match. */
  protected readonly onlineSeat = computed(
    () => this.store.online()?.seat ?? null
  );
  /** True while an online match waits for the other device. */
  protected readonly waitingForPeer = this.store.waitingForPeer;
  protected readonly social = inject(SocialService);
  /** The ban holding the player, and the owner's notices (ADR 0012). */
  protected readonly moderation = inject(ModerationService);
  /** Ranked daily attempts and endless runs (ADR 0012). */
  private readonly ranked = inject(RankedService);
  /** True while a ranked attempt is being declared. */
  protected readonly declaring = signal(false);
  /** Ranked play as the new game offers it, by mode. */
  protected readonly rankedOffers = computed(() => ({
    daily: this.ranked.offer('daily', this.settings.ranked()),
    endless: this.ranked.offer('endless', this.settings.ranked()),
  }));
  /** An invitation link opened on this visit, until it is answered. */
  protected readonly inviteOffer = signal<InviteOffer | null>(null);
  /** A match the host started while this device still cleared the last one. */
  private onlineStartPending = false;
  /** No flickering glow for players who asked their system for less motion. */
  private readonly reducedMotion = prefersReducedMotion();
  /** The bubbles and the mist in the dish, over the arena - null without a painter. */
  private ambience: DishAmbience | null = null;
  /** The view the ambience was last drawn still for - nothing to redraw while it holds. */
  private stillAmbience: Rect | null = null;
  /** The skin the player's colony wears: the look picked, once owned. */
  private readonly skin = this.evolution.worn;
  /** The look the computer wears on the level - see `seatLooks`. */
  private readonly computerLook = computed(() => computerLook(this.level().id));

  /**
   * The arena on its canvas. A new resolution gets a new canvas - see
   * {@link arenaLayout} - which is when the painter is built again.
   */
  private readonly arenaView = viewChild(ArenaViewComponent);
  private readonly ambienceRef =
    viewChild<ElementRef<HTMLCanvasElement>>('ambienceElement');
  private readonly minimapRef =
    viewChild<ElementRef<HTMLCanvasElement>>('minimapElement');
  @ViewChild('arenaStage', { static: true })
  private stageRef!: ElementRef<HTMLElement>;
  @ViewChild(WsThanosDirective, { static: true })
  private thanos!: WsThanosDirective;
  /** Draws the arena - on the GPU where the browser can; the view builds it. */
  private painter: ArenaPainter | null = null;
  /** The layout the last painter was built for - null before the first. */
  private readonly painterLayout = signal<ArenaLayout | null>(null);
  /** The camera over a map bigger than the base arena, null on any other. */
  private camera: Camera | null = null;
  /** When the camera last moved on, null before it ever did. */
  private cameraMovedAt: number | null = null;
  /** The shake of the view as a weapon goes off - on every map. */
  private readonly shake = new CameraShake();
  /** Each seat's colony colour - built anew only when a match's colours do. */
  private readonly seatColors = new SeatColors();
  /** The weapons fired since the frame before, for the next frame's content. */
  private pendingFires: readonly WeaponFire[] = [];
  /** Where the camera stands without the shake - what the minimap frames. */
  private lastCamera: Rect | null = null;
  /** The whole map in a corner, while the camera shows part of it. */
  private minimap: MinimapPainter | null = null;
  /** When the minimap last took in where the colonies are. */
  private minimapUpdatedAt = Number.NEGATIVE_INFINITY;
  /**
   * True while the painter draws the ambience with the arena - the stage
   * then lays no canvas of its own over it.
   */
  protected readonly painterAmbience = signal(false);
  /** Where the frames spend their time, while the HUD shows it. */
  private readonly framePerf = new FramePerf();
  /** How many of the canvas's pixels the frames of a match are built with. */
  private readonly quality = new AdaptiveQuality();
  /** Where the last match on each arena size left it - for the next one. */
  private readonly qualityByArena = new Map<string, number>();
  /** The fraction of the canvas's pixels the painter builds frames with. */
  private renderScale = 1;
  /**
   * The breakdown of a frame beside the frame rate - null while the
   * settings hide the frame rate, or before a window of frames is over.
   */
  protected readonly hudPerf = signal<HudPerf | null>(null);

  /**
   * The arena in cells, as fine as the simulation resolution asks for and
   * as big as the level's map.
   */
  protected readonly arena = computed(() =>
    arenaSize(this.simResolution(), this.mapSize())
  );
  /**
   * The grid the war runs on: the setting, but online the one grid both
   * devices run - also under the result of a match the other device left,
   * which a new grid would wipe off the board - and the online grid too
   * for a ranked match (`rankedPlan`), from its declaration on.
   */
  private readonly simResolution = computed((): SimResolution =>
    this.store.online() === null &&
    this.store.endedBy() !== 'forfeit' &&
    this.store.rankedMatch() === null &&
    !this.declaring()
      ? this.settings.simResolution()
      : ONLINE_SIM_RESOLUTION
  );
  /** How many times the base arena the level's map is along each side. */
  protected readonly mapSize = computed(() => levelSize(this.store.level()));
  /**
   * True while the camera shows part of a big map: in a match of one human -
   * with two, it shows the whole map. The minimap shows then, and the
   * camera zooms.
   */
  protected readonly cameraFollows = computed(
    () => this.mapSize() > 1 && this.running() && this.humans().length === 1
  );
  /**
   * What the arena view lays its canvas out for: the arena at the
   * resolutions set. Either resolution changing hands the painter a fresh
   * canvas and context.
   */
  protected readonly arenaLayout = computed((): ArenaLayout => {
    const sim = this.simResolution();
    const screen = this.settings.screenResolution();
    const size = this.mapSize();
    return {
      ...this.arena(),
      scale: renderScale(sim, screen, size),
      detail: detailScale(sim, screen, size),
      unit: simScale(sim),
    };
  });
  /**
   * True once the arena view built its painter for the layout the arena
   * has now (one with the same canvas key: the layout is recomputed, a
   * new object, on every level) - or before it built any.
   */
  private readonly arenaReady = computed(() => {
    const painted = this.painterLayout();
    return (
      painted === null || layoutKey(painted) === layoutKey(this.arenaLayout())
    );
  });
  private readonly arenaReady$ = toObservable(this.arenaReady);
  /** What the arena view paints: the match as it stands. */
  protected readonly arenaScene: ArenaScene = {
    content: (alpha) => this.content(alpha),
    view: () => this.shakenView(),
    painted: (frame) => {
      this.paintAmbience(frame.view, frame.deltaTimeSec);
      this.paintMinimap(this.lastCamera ?? frame.view, frame.dynamicWalls);
    },
  };

  stats: Signal<ColonyStats[]>;
  /** The colonies a finger may steer - one seat each in the touch layout. */
  protected readonly humanStats: Signal<ColonyStats[]>;
  /** The neutral colonies' bacteria, null on a level without any. */
  protected readonly neutralCount: Signal<number | null>;
  /** The grey the neutral colonies are drawn in. */
  protected readonly neutralCss = `rgb(${cssTriple([
    NEUTRAL_COLOR[0],
    NEUTRAL_COLOR[1],
    NEUTRAL_COLOR[2],
  ])})`;
  /**
   * The frame rate in the HUD, in whole frames - null while the settings
   * hide it, so the HUD renders again only when the number it shows changes.
   */
  protected readonly hudFps = computed(() =>
    this.settings.showFps() ? Math.round(this.store.fps()) : null
  );
  /** True while a match is on, paused or not. */
  protected readonly running: Signal<boolean>;
  protected readonly paused: Signal<boolean>;
  /**
   * What the match clock shows, once a second: the time left on a timed
   * level, else the time played - "1:05".
   */
  protected readonly clockText: Signal<string>;
  /** What the clock tells - the time left or the time played. */
  protected readonly clockLabel: Signal<string>;
  /** True in the last seconds of a timed match, while it is on. */
  protected readonly timeRunningOut: Signal<boolean>;
  /**
   * The vaporize effect as set: as long as chosen, within the quality's
   * pixel budget - a big desktop window is snapped with
   * coarser particles - and its snap as loud as the game's other effects.
   */
  protected readonly thanosOptions = computed((): Partial<WsThanosOptions> => {
    const gain = this.sound.effectsGain();
    return {
      animationLength: this.settings.vaporizeMs(),
      maxCapturePixels: vaporizePixels(this.settings.vaporize()),
      sound: gain > 0,
      soundVolume: gain * SNAP_LEVEL,
    };
  });
  /**
   * What a colony counts up towards on a level won by reaching a goal - the
   * seconds on the zone, the pellets eaten - null on any other level.
   */
  protected readonly goal = computed((): HudGoal | null => {
    const rule = this.store.winRule();
    const hold = holdTarget(rule);
    if (hold !== null) {
      return {
        icon: 'flag',
        label: 'stage.hud.secondsHeld',
        target: hold,
        of: 'held',
      };
    }
    const harvest = harvestTarget(rule);
    return harvest === null
      ? null
      : {
          icon: 'restaurant',
          label: 'stage.hud.pelletsEaten',
          target: harvest,
          of: 'pellets',
        };
  });
  /** The goal of the training mission under way, for the arena - null outside one. */
  protected readonly missionGoal = computed((): TranslationKey | null => {
    const { mission } = this.store.level();
    return mission === undefined ? null : missionKeys(mission).goal;
  });
  /** True once a match is over and its result is shown, until the next one. */
  protected readonly matchOver: Signal<boolean>;
  /** The name of the computer's difficulty, for the menu's summary line. */
  protected readonly difficultyName: Signal<string>;

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
   * menu's between matches, and nothing on the pause menu and at the end
   * of a match.
   */
  private readonly soundtrack = computed<Soundtrack | null>(() => {
    if (this.running() && !this.paused()) {
      return levelMusic(this.level().id);
    }
    const inMenu = !this.running() && !this.matchOver() && !this.resetting();
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
    return panel !== null && panel !== 'pause' && panel !== 'over';
  });
  /** True while the browser shows the stage on the whole screen. */
  protected readonly nativeFullscreen = signal(false);
  /** False where the browser has no Fullscreen API, as on iPhones. */
  protected readonly nativeFullscreenSupported = signal(false);
  /** False where the device cannot vibrate - the setting is left out then. */
  protected readonly vibrationSupported = this.haptics.supported;

  /** The level the next match is played on. */
  protected readonly level: Signal<Level>;
  /** Its name in the HUD: "3 · Hourglass". */
  protected readonly levelName = computed(() => levelNameText(this.level()));
  /** Balance of the selected level - drives both rendering and the scoreboard. */
  protected readonly balance: Signal<GameBalance>;
  /** Walls of the selected level, drawn every frame. */
  protected readonly walls: Signal<Rect[]>;
  /** Zones of the selected level, drawn under the walls. */
  protected readonly zones: Signal<Zone[]>;
  /** How the selected level looks and sounds. */
  protected readonly theme: Signal<ArenaTheme>;
  /** The frame colour of the arena, as a CSS `rgb()` triple. */
  protected readonly arenaBorder: Signal<string>;
  /** The darkest floor colour of the arena, for the stage around it. */
  protected readonly arenaRim: Signal<string>;
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
  /** Why each level is still locked on the campaign ladder, by level id. */
  protected readonly campaign = inject(CampaignService);
  protected readonly lockedLevels = this.campaign.locks;
  /**
   * The locked levels of the level choice: the ladder's, and online the
   * big maps, which the CPU both devices run cannot keep up with.
   */
  protected readonly choiceLocks = computed(() =>
    this.lastKind() === 'online' ? ONLINE_LOCKS : this.lockedLevels()
  );
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
   * the player's - for the menu screens. Online the player's colour is
   * their seat's in the match, which for the guest is the right one.
   */
  protected readonly colonyRgb = computed(
    () =>
      this.store.playerColors().map((id) => getColonyColor(id).rgb) as [
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
    const locks =
      this.store.online() === null ? this.lockedLevels() : ONLINE_LOCKS;
    return upcoming === null ? null : (locks[upcoming.id] ?? null);
  });
  /**
   * True where Restart may start the match again - online, the host only;
   * never a ranked match, whose declared seed plays once.
   */
  protected readonly canRestart = computed(
    () =>
      !this.inEndlessRun() &&
      this.store.rankedMatch() === null &&
      this.onlineSeat() !== 1
  );
  /**
   * True where the match may be paused: never a ranked one, whose attempt
   * has a deadline from its declaration on (ADR 0012).
   */
  protected readonly canPause = computed(
    () => this.store.rankedMatch() === null
  );
  /** "Give up" in two taps. */
  private readonly giveUpTap = armedTap<true>();
  /** True while the first tap on "Give up" waits for the second. */
  protected readonly giveUpArmed = computed(
    () => this.giveUpTap.armed() !== null
  );
  /** The crosshairs a finger or a key may steer - never the computer's. */
  private readonly humans: Signal<Player[]>;

  /**
   * True while the stage is laid over the whole viewport rather than
   * embedded in the page; it looks the same either way. A touch device opens
   * this way - a phone between two players has no room for a page around the
   * game.
   *
   * This is the component's own layout and works everywhere. On top of it the
   * browser's Fullscreen API is used where it exists, to hide the browser
   * chrome as well - see {@link requestNativeFullscreen}.
   */
  protected readonly fullscreen = signal(isTouchDevice());
  /**
   * How far below the top of the page the embedded stage starts, in CSS
   * pixels: it fills the viewport from there - see {@link measureStageTop}.
   */
  protected readonly stageTop = signal(0);
  /** The box around the canvas in CSS pixels, null before its first layout. */
  private readonly arenaBoxSize = signal<Size | null>(null);
  /**
   * Explicit canvas size: the largest box with the arena's aspect ratio that
   * fits the box around it. Null before the box was first laid out.
   *
   * Letting CSS scale the drawing inside a bigger element would work visually,
   * but the pointer maths maps a touch through the bounding rect of the canvas
   * - padding hidden in that rect would offset every crosshair drag.
   */
  protected readonly canvasSize = computed(() => {
    const box = this.arenaBoxSize();
    // Leave room for the glowing frame around the arena.
    const frame = 2 * ARENA_FRAME_PX;
    return box != null
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
  /** The fingers on the arena, two of which may pinch the camera. */
  private readonly pinch = new Pinch();

  constructor() {
    this.gameStateService.reset();
    // A series lasts for a visit of the page: one left unfinished last time
    // does not carry over.
    this.gameStateService.endSeries();

    this.level = this.store.level;
    this.balance = computed(() =>
      levelBalance(this.level(), gridScale(this.level(), this.arena().width))
    );
    this.walls = computed(() => {
      const { width, height } = this.arena();
      return levelMap(this.level()).createWalls(width, height);
    });
    this.zones = computed(() => {
      const { width, height } = this.arena();
      return mapZones(levelMap(this.level()), width, height);
    });
    this.upcomingLevel = computed(() => nextLevel(this.level().id));
    void this.takeChallenge();
    void this.takeInvite();
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
    // Online, the other colony goes by its player's name, once their
    // profile is in - it may come after the match started.
    const named = computed(() => {
      const online = this.store.online();
      const name = this.social.opponent()?.card.name;
      return online === null || name === undefined
        ? players()
        : players().map((player) =>
            player.id === online.seat ? player : { ...player, name }
          );
    });
    this.stats = computed(() => toColonyStats(named(), this.balance()), {
      equal: sameColonyStats,
    });
    this.neutralCount = this.playerStore.neutralCount;
    this.humanStats = computed(() =>
      this.stats().filter((colony) => !colony.isBot)
    );

    // Repaint as soon as another level puts different walls into the arena, or
    // the colonies change colour or look, so the start screen always shows
    // the map and the colonies the next match is fought with. A clear frame
    // also wipes the glow from the trail once the player asks for less
    // motion, even while the game is paused. The arena view lays another
    // level's floor itself.
    effect(() => {
      this.ambience?.setTheme(this.theme());
      this.walls();
      this.colors();
      this.skin();
      this.settings.ambience();
      this.reducedMotion();
      this.draw();
    });

    // The GPU self-test runs once this device plays the deterministic
    // simulation: always with the owner's toggle on, else once the device
    // override opts it in (`?sim=gpu-int`) - from the URL at once, from the
    // storage maybe later than the arena.
    this.simulationOverride.start();
    // Ranked play needs its verdict as well: ranked matches play gpu-int.
    effect(() => {
      const toggles = this.featureToggles();
      if (
        toggles.deterministicSimulation ||
        toggles.rankedDaily ||
        toggles.rankedEndless ||
        this.simulationOverride.override() === 'gpu-int'
      ) {
        untracked(() => this.gpuSelfTest.check());
      }
    });
    // Its verdict on the canvas, beside the simulation - for the e2e tests
    // and for debugging.
    effect(() => {
      const dataset = this.arenaView()?.canvas()?.dataset;
      if (dataset != null) {
        dataset['gpuSelfTest'] = selfTestState(this.gpuSelfTest.result());
      }
    });

    // The minimap is drawn afresh for another map, and goes with the match.
    effect(() => {
      const canvas = this.minimapRef()?.nativeElement;
      const cx = canvas?.getContext('2d');
      const { width, height } = this.arena();
      const theme = this.theme();
      const walls = this.walls();
      untracked(() => {
        this.minimap =
          cx == null ? null : new MinimapPainter(cx, width, height);
        this.minimap?.setMap(theme, walls);
        this.minimapUpdatedAt = Number.NEGATIVE_INFINITY;
        this.draw();
      });
    });

    this.running = this.store.isMatchOn;
    this.paused = this.store.isPaused;
    this.clockText = computed(() =>
      clock(this.store.secondsLeft() ?? this.store.gameSeconds())
    );
    this.clockLabel = computed(() =>
      this.i18n.t(
        this.store.secondsLeft() === null
          ? 'stage.hud.gameTime'
          : 'stage.hud.timeLeft'
      )
    );
    this.timeRunningOut = computed(
      () =>
        this.running() &&
        (this.store.secondsLeft() ?? Infinity) <= RUNNING_OUT_SEC
    );
    this.matchOver = this.store.matchEnded;
    // A pause or the end of a match stops the match's frames: one more
    // frame lets the camera ease on by itself from there.
    effect(() => {
      if (!this.running() || this.paused()) {
        untracked(() => this.draw());
      }
    });
    // The breakdown of a frame starts over with each match, and whenever
    // the frame rate is shown again - no frames of before in its average.
    effect(() => {
      this.settings.showFps();
      this.running();
      untracked(() => {
        this.framePerf.reset();
        this.hudPerf.set(null);
      });
    });
    // A match starts at the sharpness the last one on its arena ended with;
    // between matches, and with the setting off, every pixel is painted.
    effect(() => {
      const adapts = this.running() && this.settings.adaptiveQuality();
      untracked(() => {
        if (adapts) {
          this.quality.start(this.qualityByArena.get(this.arenaKey()) ?? 1);
        }
        this.setRenderScale(adapts ? this.quality.scale : 1);
      });
    });
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

    this.difficultyName = computed(() =>
      this.i18n.t(difficultyKeys(this.difficulty()).name)
    );

    this.gameStateService.frames$
      .pipe(untilDestroyed(this))
      .subscribe((frame) => this.runFrame(frame));

    // The guest of an online match plays what the host starts.
    this.online.events$
      .pipe(
        filter((event) => event.type === 'start'),
        untilDestroyed(this)
      )
      .subscribe(() => this.followOnlineStart());
    // The host of a match the matchmaking set up starts it at once.
    this.online.events$
      .pipe(
        filter(
          (event) =>
            event.type === 'connected' && event.auto && event.seat === 0
        ),
        untilDestroyed(this)
      )
      .subscribe(() => this.startMatchmadeMatch());
  }

  /**
   * Starts an automatic online match on the level the matchmaking picked -
   * a random level that plays online if it has none.
   */
  private startMatchmadeMatch(): void {
    this.gameStateService.setLevel(
      this.matchmaker.matchLevel()?.levelId ??
        pickMatchLevel(null, null, Math.random).levelId
    );
    this.startGame();
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

  /**
   * Takes the invitation a link carries in its hash (`#friend=<token>`)
   * and offers to add the inviter as a friend - and takes it out of the
   * address, so a reload does not offer it again.
   */
  private async takeInvite(): Promise<void> {
    const match = /^#friend=([a-z2-9]{20})$/.exec(this.document.location.hash);
    if (match === null || !this.social.available) {
      return;
    }
    const token = match[1];
    await this.router.navigateByUrl(this.router.url.split('#')[0], {
      replaceUrl: true,
    });
    const from = await this.social.readInvite(token).catch(() => null);
    if (from !== null) {
      this.inviteOffer.set({ token, from });
    }
  }

  /** Takes a friend's challenge: on to the online lobby, into their room. */
  protected playChallenge(call: ChallengeView): void {
    this.setPlayKind('online');
    this.newGameEntry.set({ kind: 'online', step: 'start' });
    this.show('new-game');
    void this.online.join(call.code);
  }

  /** Challenges a friend from the friends screen: on to the online lobby. */
  protected challengeFriend(friend: FriendView): void {
    if (this.onlineLobby().phase !== 'idle') {
      return;
    }
    this.setPlayKind('online');
    this.newGameEntry.set({ kind: 'online', step: 'start' });
    this.show('new-game');
    this.social.challengeFriend(friend);
  }

  /** Today's daily level for the main menu. */
  protected readonly dailyCard = computed((): DailyCard => {
    const { levelId, attemptsLeft, streak } = this.progress.daily();
    return { levelId, attemptsLeft, streak };
  });

  /**
   * The training mission picked in a new game - the first one still to do
   * until the player picks another.
   */
  protected readonly missionId = computed(
    () => this.pickedMission() ?? this.progress.firstOpenMission()
  );
  /**
   * The mission the player picked - kept whatever the progress tells
   * meanwhile - null to offer the first one still to do.
   */
  private readonly pickedMission = signal<MissionId | null>(null);

  /** Picks a training mission for the next start. */
  protected pickMission(id: MissionId): void {
    this.pickedMission.set(id);
  }

  /** Starts a training mission's match. */
  protected playMission(id: MissionId): void {
    if (this.resetting()) {
      return;
    }
    this.pickedMission.set(id);
    this.gameStateService.leaveOnline();
    this.gameStateService.playMission(id);
    this.startGame();
  }

  /** Opens the training's missions, from the main menu. */
  protected openTraining(): void {
    // Offers the first mission still to do.
    this.pickedMission.set(null);
    this.setPlayKind('training');
    this.newGameEntry.set({ kind: 'training', step: 'level' });
    this.show('new-game');
  }

  /** True in a match of an endless run - no restart, it would cost no life. */
  protected readonly inEndlessRun = this.store.endlessMatch;

  /**
   * Starts a new endless run, on its first level - a ranked one (ADR 0012)
   * where ranked play is offered and wanted: its match 0 declared first.
   */
  protected async playEndless(): Promise<void> {
    if (this.resetting() || this.declaring()) {
      return;
    }
    this.gameStateService.leaveOnline();
    if (this.ranked.wants('endless', this.settings.ranked())) {
      const start = await this.whileDeclaring(() => this.ranked.startRun());
      if (this.startedMeanwhile()) {
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
  protected async playDaily(): Promise<void> {
    // Not while the last match still turns to dust - the reset would end it.
    if (this.resetting() || this.declaring()) {
      return;
    }
    this.gameStateService.leaveOnline();
    // A ranked attempt plays its own day's level, past midnight too.
    const day = this.progress.daily().day;
    if (this.ranked.wants('daily', this.settings.ranked())) {
      const attempt = await this.whileDeclaring(() =>
        this.ranked.declareDaily()
      );
      if (this.startedMeanwhile()) {
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
  private async continueRun(): Promise<void> {
    const { endless, endlessRanked } = this.store.snapshot();
    if (endless === null || isRunOver(endless)) {
      await this.playEndless();
      return;
    }
    const next =
      endlessRanked === null
        ? null
        : await this.whileDeclaring(() =>
            this.ranked.declareRunMatch(endlessRanked)
          );
    if (this.startedMeanwhile()) {
      return;
    }
    this.gameStateService.continueEndless(next);
    await this.startWhenArenaReady();
  }

  /**
   * True when another match started (or the last one is still being
   * reset) while a declaration was under way: the declared start is void
   * then, rather than ending that match.
   */
  private startedMeanwhile(): boolean {
    return this.running() || this.resetting();
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
   * after the grid changed. Waits a little at most.
   */
  private async startWhenArenaReady(): Promise<void> {
    if (!untracked(this.arenaReady)) {
      await firstValueFrom(
        this.arenaReady$.pipe(
          filter(Boolean),
          timeout({ first: ARENA_READY_MS, with: () => of(true) })
        )
      );
    }
    this.startGame();
  }

  /** Starts a match against the ghost of the run someone shared. */
  protected fightChallenge(): void {
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
    this.requestNativeFullscreen();
    this.busy.run(start);
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
    // Where the training goes on, as the mission's result says.
    const mission =
      action === 'mission'
        ? (this.store.snapshot().earnings?.training?.next ?? null)
        : null;
    // The reset ends a match set outside the setup: a rematch sets it again.
    const rematch =
      action === 'again' ? this.gameStateService.oneMatch() : null;
    if (action === 'levels') {
      // The daily level and an endless run have no level to choose: their
      // mode then, to pick another.
      const kind = this.playKind();
      this.newGameEntry.set({
        kind,
        step: stepsOf(kind).includes('level') ? 'level' : 'mode',
      });
    }
    this.screen.set(
      action === 'levels'
        ? 'new-game'
        : action === 'evolve'
          ? 'evolution'
          : action === 'watch'
            ? 'replay'
            : 'menu'
    );
    if (action === 'menu' || action === 'evolve' || action === 'watch') {
      this.gameStateService.endSeries();
      this.gameStateService.leaveOnline();
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
            void this.continueRun();
            return;
          }
          if (rematch?.dailyDay != null) {
            // Again on the daily level: ranked again where it may be.
            void this.playDaily();
            return;
          }
          if (mission !== null) {
            this.pickedMission.set(mission);
            this.gameStateService.playMission(mission);
          }
          if (action === 'campaign') {
            this.playFurthestLevel();
          } else if (
            action === 'again' ||
            action === 'next' ||
            action === 'ghost' ||
            mission !== null
          ) {
            this.startGame();
          }
        }),
        untilDestroyed(this)
      )
      .subscribe();
  }

  /**
   * Starts the match the host of an online match started - once the arena
   * is clear: a result on screen is cleared first.
   */
  private followOnlineStart(): void {
    if (this.resetting() || this.matchOver()) {
      this.onlineStartPending = true;
      if (!this.resetting()) {
        // Not resetGame: that gives the online match up.
        this.resetGame$().pipe(untilDestroyed(this)).subscribe();
      }
      return;
    }
    this.startOnlineMatch();
  }

  private startOnlineMatch(): void {
    // Not once this device has left - it would start a match of its own.
    if (this.store.snapshot().online?.seat === 1) {
      this.startGame();
    }
  }

  /** Opens an online match for a friend to join. */
  protected hostOnline(): void {
    void this.online.host();
  }

  /** Joins a friend's online match under the code they passed on. */
  protected joinOnline(code: string): void {
    void this.online.join(code);
  }

  /** Leaves the online match, or its lobby. */
  protected leaveOnline(): void {
    this.gameStateService.leaveOnline();
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

  /** The settings' way back: to the pause menu during a match. */
  protected readonly settingsBackLabel = computed(() =>
    this.i18n.t(this.paused() ? 'stage.pause.back' : 'common.menu')
  );

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

  /** The level picked for the next match, beside the daily and the run. */
  protected readonly selectedLevelId = this.store.levelId;
  /** The level the level choice shows picked - online, the host's. */
  protected readonly choiceLevelId = computed(
    () => this.store.online()?.levelId ?? this.selectedLevelId()
  );

  /** Where a new game opens - on the mode last played, to pick another. */
  protected readonly newGameEntry = signal<NewGameEntry>({
    kind: null,
    step: 'mode',
  });

  /** The levels of the ladder open so far, for the campaign's mode card. */
  protected readonly openLevels = computed(
    () => this.campaign.summary().openLevels
  );

  /** The mode picked in a new game this visit, null before. */
  private readonly lastKind = signal<PlayKind | null>(null);

  /**
   * The mode last played: the training while one of its missions is set,
   * else the one picked in a new game, else the daily level or an endless
   * run while one is on, else who plays and whether the ladder applies.
   * The training is played a mission at a time: picked once, it is no mode
   * the campaign's Continue would come back to.
   */
  private readonly playKind = computed((): PlayKind => {
    const matchLevel = this.store.matchLevel();
    if (matchLevel !== null && getLevel(matchLevel).mission !== undefined) {
      return 'training';
    }
    const last = this.lastKind();
    if (last !== null && last !== 'training') {
      return last;
    }
    if (this.store.dailyDay() !== null) {
      return 'daily';
    }
    if (this.store.endlessMatch()) {
      return 'endless';
    }
    if (this.mode() === 'two-players') {
      return 'two-players';
    }
    return this.settings.freePlay() ? 'free' : 'campaign';
  });

  /** Opens a new game on its first step. */
  protected openNewGame(): void {
    this.newGameEntry.set({ kind: this.playKind(), step: 'mode' });
    this.show('new-game');
    // Today's ranked attempts and runs left, for the daily and endless -
    // read once each visit, which picking a mode then takes from.
    void this.ranked.refresh();
  }

  /**
   * Sets the game up for a mode: who plays, and whether the ladder's locks
   * apply - the campaign service keeps the next match on an open ladder
   * level while they do.
   */
  protected setPlayKind(kind: PlayKind): void {
    this.lastKind.set(kind);
    if (kind !== 'online') {
      // Another mode is no online match.
      this.gameStateService.leaveOnline();
    }
    const opponent = opponentOf(kind);
    if (opponent !== null) {
      this.selectMode(opponent);
    }
    if (kind === 'campaign' || kind === 'free') {
      this.settings.setFreePlay(kind === 'free');
    }
    if (kind === 'daily' || kind === 'endless') {
      void this.ranked.refresh(false);
    }
  }

  /**
   * Starts what a new game set up: a match, the daily level, a run or a
   * training mission.
   */
  protected startNewGame(kind: PlayKind): void {
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

  /** Starts a match on the furthest level the campaign ladder has opened. */
  protected continueCampaign(): void {
    this.startOnTap(() => this.playFurthestLevel());
  }

  private playFurthestLevel(): void {
    this.gameStateService.leaveOnline();
    this.selectMode('vs-computer');
    this.gameStateService.setLevel(this.campaign.furthestLevel());
    this.startGame();
  }

  /**
   * The ranked match's way out, which has no pause menu: the first tap
   * arms it for a few seconds, the second gives the match up - its
   * attempt then counts as played.
   */
  protected giveUp(): void {
    if (this.giveUpTap.tap(true)) {
      this.quitToMenu();
    }
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
    // The owner's toggles once the game is up: Remote Config stays off the
    // start, and the defaults hold until it answered.
    this.featureTogglesService.start();
    this.nativeFullscreenSupported.set(
      isFullscreenSupported(document, this.stageRef?.nativeElement)
    );
    this.measureStageTop();
    this.requestNativeFullscreenOnOpen();
  }

  /**
   * Measures where the embedded stage starts on the page - below the shell's
   * toolbar, or right at the top on the game's own site - so that it fills
   * the rest of the viewport. Laid over the viewport it keeps the last value.
   */
  @HostListener('window:resize')
  protected measureStageTop(): void {
    const stage = this.stageRef?.nativeElement;
    if (this.fullscreen() || stage == null) {
      return;
    }
    const top = stage.getBoundingClientRect().top + window.scrollY;
    this.stageTop.set(Math.max(0, Math.round(top)));
  }

  /**
   * Takes the painter the arena view built for a fresh canvas, at the
   * resolutions it was rendered for - null right before it lets go of the
   * one before. Resolutions only change between matches, so the colonies
   * are simply spawned again on the new grid.
   */
  protected onPainterChange(painter: ArenaPainter | null): void {
    this.painter = painter;
    this.painterAmbience.set(painter?.paintsAmbience === true);
    painter?.setRenderScale?.(this.renderScale);
    if (painter != null) {
      this.painterLayout.set(untracked(this.arenaLayout));
    }
    if (painter == null) {
      // The GPU simulation lives in the old context: let it go while it lasts.
      this.playerService.useSimulation(null);
      return;
    }
    const { width, height } = this.arena();
    this.camera =
      this.mapSize() > 1 ? new Camera(width, height, this.mapSize()) : null;
    this.ambience = new DishAmbience(width, height);
    this.ambience.setTheme(this.theme());
    // With a WebGL2 context the war itself runs on the GPU as well - for a
    // deterministic match only once the GPU passed the self-test.
    const gl = painter instanceof GlArenaPainter ? painter : null;
    if (gl != null) {
      this.gpuSelfTest.sawRenderer(gl.renderer());
    }
    const choice = chooseSimulation({
      // The owner's toggle, read as each match starts: Remote Config may
      // answer after the arena is up, and a match keeps its simulation.
      deterministic: () =>
        untracked(() => this.featureToggles().deterministicSimulation),
      gpu:
        gl == null
          ? null
          : (balance, random, options) =>
              gl.createSimulation(balance, random, options),
      gpuTrusted: () => gpuTrusted(this.gpuSelfTest.result()),
      override: this.simulationOverride.override,
    });
    this.playerService.useSimulation(choice.factory, choice.fallback, choice);
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
    this.arenaView()?.clearNext();
    this.camera?.reset();
    this.cameraMovedAt = null;
    this.shake.reset();
    this.gameStateService.cleanup();
    this.gameStateService.init(this.arena().width, this.arena().height);
    this.gameStateService.start();
  }

  private vaporize(): Observable<void> {
    // Switched off, the arena simply clears - still after the caller is
    // through, as it would after the effect.
    if (this.settings.vaporize() === 'off') {
      return timer(0, asapScheduler).pipe(map(() => undefined));
    }
    // The effect takes its snapshot of the canvas right away.
    this.painter?.showLastFrame();
    return this.thanos.vaporize(false).pipe(take(1));
  }

  /**
   * Pauses, vaporizes the canvas and returns to the start screen - giving
   * an online match up, which the other device then wins.
   */
  resetGame() {
    this.gameStateService.leaveOnline();
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
          if (this.onlineStartPending) {
            this.onlineStartPending = false;
            this.startOnlineMatch();
          }
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
    // Timed only while the HUD shows the frame rate.
    const perf = untracked(this.settings.showFps) ? this.framePerf : null;
    const timer = perf === null ? null : (this.painter.gpuTimer?.() ?? null);
    // The ticks' GPU time where the war runs on the GPU.
    const simTimer =
      timer !== null && this.playerService.getSimulation().kind === 'gpu'
        ? timer
        : null;
    const start = performance.now();
    simTimer?.begin('sim');
    this.gameStateService.advance(width, height, frame.ticks);
    simTimer?.end();
    const ticked = performance.now();
    const events = this.playerService.getFrameEvents();
    this.sound.frame(events);
    this.haptics.frame(events);
    this.shake.fire(events.weapons, this.reducedMotion());
    // The shake goes with the match's frames: a pause holds the view still.
    this.shake.advance(frame.elapsedSec);
    this.pendingFires = events.weapons;
    const painting = perf === null ? 0 : performance.now();
    timer?.begin('draw');
    this.arenaView()?.paintFrame(frame.elapsedSec, frame.alpha);
    timer?.end();
    // A war on the GPU keeps the main thread waiting for its reports: that
    // is time the GPU takes, not the main thread's own.
    const gpuTicks =
      this.playerService.getSimulation().kind === 'gpu' ? ticked - start : 0;
    this.adaptQuality(performance.now() - start - gpuTicks);
    if (perf !== null) {
      this.notePerf(perf, timer, frame.ticks, start, ticked, painting);
    }
  }

  /**
   * Builds the next frames with fewer pixels, or more, as they come - from
   * how long this one kept the main thread busy with its ticks and painting.
   */
  private adaptQuality(busyMs: number): void {
    if (
      this.painter?.setRenderScale == null ||
      !untracked(this.running) ||
      !untracked(this.settings.adaptiveQuality)
    ) {
      return;
    }
    const scale = this.quality.frame(performance.now(), busyMs);
    if (scale !== null) {
      this.qualityByArena.set(this.arenaKey(), scale);
      this.setRenderScale(scale);
    }
  }

  private setRenderScale(scale: number): void {
    this.renderScale = scale;
    this.painter?.setRenderScale?.(scale);
  }

  /** The arena's size, which the sharpness a device manages goes by. */
  private arenaKey(): string {
    const { width, height } = untracked(this.arena);
    return `${width}×${height}`;
  }

  /** Takes a frame's timings, and shows the averages once a window is over. */
  private notePerf(
    perf: FramePerf,
    timer: GpuTimer | null,
    ticks: number,
    start: number,
    ticked: number,
    painting: number
  ): void {
    const end = performance.now();
    timer?.poll((slot, ms) => perf.recordGpu(slot, ms));
    const report = perf.record(end, ticked - start, end - painting, ticks);
    if (report === null) {
      return;
    }
    const simulation = this.playerService.getSimulation();
    const { width, height } = this.arena();
    this.hudPerf.set({
      ...report,
      simulation: simulationLabel(simulation.kind, simulation.ruleset),
      cells: `${width}×${height}`,
      // The Canvas 2D painter paints every pixel, whatever the scale says.
      pixels: this.painter?.setRenderScale == null ? 1 : this.renderScale,
    });
  }

  /**
   * Paints the arena as it stands, on the next animation frame, without
   * advancing the war - whenever it changes while nobody is playing.
   */
  private draw(): void {
    if (this.painter != null) {
      this.arenaView()?.repaint();
    }
  }

  /**
   * Draws the bubbles and the mist over the arena, on the canvas laid over
   * it, at the arena canvas's own pixels. Still for a player who asked for
   * less motion, and while the match does not paint: then only the dish's
   * depth is drawn, and only once per view and canvas size.
   */
  private paintAmbience(view: Rect, deltaTimeSec: number): void {
    const ambience = this.ambience;
    if (ambience == null || !this.settings.ambience()) {
      return;
    }
    const moving = !this.reducedMotion() && this.matchPaints();
    if (untracked(this.painterAmbience)) {
      // The painter draws it with the arena: here it only moves on.
      if (moving) {
        ambience.advance(deltaTimeSec);
      }
      return;
    }
    const canvas = this.ambienceRef()?.nativeElement;
    const arena = this.arenaView()?.canvas();
    if (canvas == null || arena == null) {
      return;
    }
    const { width, height } = arena;
    const resized = canvas.width !== width || canvas.height !== height;
    if (resized) {
      canvas.width = width;
      canvas.height = height;
    }
    const still = this.stillAmbience;
    if (
      !moving &&
      !resized &&
      still != null &&
      still.x === view.x &&
      still.y === view.y &&
      still.width === view.width
    ) {
      return;
    }
    const cx = canvas.getContext('2d');
    if (cx == null) {
      return;
    }
    if (moving) {
      ambience.advance(deltaTimeSec);
    }
    ambience.paint(cx, view, width, height, !this.reducedMotion());
    this.stillAmbience = moving ? null : { ...view };
  }

  /**
   * Draws the minimap: the camera's frame on every frame, where the
   * colonies are ten times a second - enough to follow a fight.
   */
  private paintMinimap(view: Rect, dynamicWalls: readonly DynamicWall[]): void {
    if (this.minimap == null) {
      return;
    }
    const now = performance.now();
    if (now - this.minimapUpdatedAt >= MINIMAP_UPDATE_MS) {
      const simulation = this.playerService.getSimulation();
      const blocks = simulation.blockCounts();
      if (blocks != null) {
        this.minimap.update(
          blocks,
          simulation.summaries().map((colony) => colony.color)
        );
        this.minimapUpdatedAt = now;
      }
    }
    this.minimap.paint(view, dynamicWalls);
  }

  /**
   * Moves the camera over a big map - after the crosshair of the one human
   * in a match, to the whole arena otherwise - and returns what of the
   * arena the frame shows: all of it on a base map.
   */
  private moveCamera(): Rect {
    const { width, height } = this.arena();
    if (this.camera == null) {
      return { x: 0, y: 0, width, height };
    }
    const now = performance.now();
    const deltaSec =
      this.cameraMovedAt == null
        ? 0
        : Math.min(0.1, (now - this.cameraMovedAt) / 1000);
    this.cameraMovedAt = now;
    const target = this.cameraTarget();
    this.camera.follow(target, deltaSec);
    if (this.camera.settledOn(target)) {
      // Its next move starts afresh, not with the time it sat still.
      this.cameraMovedAt = null;
    } else if (!this.matchPaints()) {
      // No match frame moves it on now - a finished match, a pause, the
      // start screen: it asks for frames itself until it arrives.
      this.draw();
    }
    return this.camera.viewRect();
  }

  /** True while a running match paints every frame. */
  private matchPaints(): boolean {
    return untracked(this.running) && !untracked(this.paused);
  }

  /** What the camera follows: the one human's crosshair in a match. */
  private cameraTarget(): Point | null {
    const humans = untracked(this.humans);
    return untracked(this.running) && humans.length === 1
      ? this.playerService.crosshairAt(humans[0], 1)
      : null;
  }

  /**
   * The wheel zooms the camera over a big map, in or out - during a match
   * of one human; otherwise it shows the whole map and the wheel scrolls
   * the page.
   */
  protected onWheel(event: WheelEvent): void {
    if (!this.zooms()) {
      return;
    }
    event.preventDefault();
    // In pixels: Firefox counts a mouse wheel's notches in lines.
    const perUnit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? 400
          : 1;
    this.zoomBy(Math.exp((-event.deltaY * perUnit) / 500));
  }

  /**
   * True while the camera may zoom: over a big map, in a match it follows
   * the one human through - with two, it shows the whole map.
   */
  private zooms(): boolean {
    return this.camera != null && this.cameraTarget() != null;
  }

  protected zoomBy(factor: number): void {
    if (factor === 1) {
      return;
    }
    this.camera?.zoomBy(factor);
    if (!this.matchPaints()) {
      this.draw();
    }
  }

  /** What the arena shows right now, for the painter. */
  private content(alpha: number): ArenaContent {
    const simulation = this.playerService.getSimulation();
    // Which processor runs the war - for the e2e tests and for debugging.
    // The match picks it, so it can fall back to the CPU after a GPU error.
    const dataset = this.arenaView()?.canvas()?.dataset;
    if (dataset != null && dataset['simulation'] !== simulation.kind) {
      dataset['simulation'] = simulation.kind;
    }
    const players = untracked(this.playerStore.entities);
    return {
      ...arenaContent({
        players,
        crosshairAt: (player) => this.playerService.crosshairAt(player, alpha),
        simulation,
        walls: this.walls(),
        balance: this.balance(),
        looks: seatLooks(players, this.skin(), this.computerLook()),
        reducedMotion: this.reducedMotion(),
        weaponFires: this.takeFires(),
        seatColors: this.seatColors,
        screenResolution: this.settings.screenResolution(),
      }),
      ambience:
        this.painterAmbience() && this.settings.ambience()
          ? this.ambience
          : null,
    };
  }

  /** The weapons fired since the frame before - each goes into one frame. */
  private takeFires(): readonly WeaponFire[] {
    const fires = this.pendingFires;
    this.pendingFires = [];
    return fires;
  }

  /** The camera moved on, shaken while a match plays and a weapon goes off. */
  private shakenView(): Rect {
    const camera = this.moveCamera();
    this.lastCamera = camera;
    const { width, height } = this.arena();
    return this.matchPaints()
      ? this.shake.shake(camera, width, height)
      : camera;
  }

  ngOnDestroy(): void {
    this.gameStateService.leaveOnline();
    this.gameStateService.endSeries();
    this.gameStateService.cleanup();
    // The GPU simulation lives in this canvas's context, which goes with it.
    // The arena view disposes the painter.
    this.playerService.useSimulation(null);
    this.sound.setMusic(null);
    // Leaving the page must give the screen back as well.
    exitFullscreen(document);
    unlockOrientation(screen);
  }

  /** Toggles pause - the touch equivalent of the P key. */
  togglePause() {
    // A ranked match plays through: the music too.
    if (!this.paused() && !this.canPause()) {
      return;
    }
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

  /** Fires a player's weapon - the button next to the boost. */
  protected fireWeapon(playerId: number): void {
    this.gameStateService.fireWeapon(playerId);
  }

  /** Pushes or releases a player's on-screen joystick. */
  protected steer(playerId: number, vector: SteeringVector): void {
    this.playerService.setSteering(playerId, vector);
  }

  /**
   * Lays the stage over the whole viewport and asks the browser for its
   * fullscreen on top. Called from a gesture - a button or the F key -
   * where the browser grants the request.
   */
  protected enterFullscreen(): void {
    this.fullscreen.set(true);
    this.requestNativeFullscreen();
  }

  /** The fullscreen buttons: onto the whole viewport, or back into the page. */
  protected setFullscreen(on: boolean): void {
    if (on) {
      this.enterFullscreen();
    } else {
      this.leaveFullscreen();
    }
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

  /** Brings the stage back into the page. */
  protected leaveFullscreen(): void {
    this.fullscreen.set(false);
    exitFullscreen(document);
    afterNextRender(() => this.measureStageTop(), { injector: this.injector });
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
   * Remembers the size of the box around the canvas, which the stage
   * fits the canvas into - see {@link canvasSize}.
   */
  protected onArenaBoxResized(event: ResizedEvent): void {
    this.arenaBoxSize.set({ width: event.newWidth, height: event.newHeight });
  }

  /**
   * Grabs the crosshair nearest to the touch and starts dragging it.
   *
   * Two pointers can be active at once, one per player, so both can play on the
   * same screen. A second finger with no crosshair left to grab pinches the
   * camera over a big map with the first, which lets go of its crosshair.
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
      if (
        this.zooms() &&
        this.pinch.start(event.pointerId, clientPoint(event))
      ) {
        this.draggedBy.clear();
        (event.target as Element).setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
      return;
    }
    this.draggedBy.set(event.pointerId, playerId);
    this.pinch.down(event.pointerId, clientPoint(event));
    // Keep receiving moves once the finger slides off the canvas.
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.playerService.setDragTarget(playerId, point.x, point.y);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent) {
    const factor = this.pinch.move(event.pointerId, clientPoint(event));
    if (this.pinch.pinches(event.pointerId)) {
      this.zoomBy(factor);
      event.preventDefault();
      return;
    }
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
    this.pinch.up(event.pointerId);
  }

  private toArenaPoint(event: PointerEvent) {
    const view = this.arenaView();
    const canvas = view?.canvas();
    if (view == null || canvas == null) {
      return null;
    }
    return arenaPointFromClient(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      view.shownView() ?? { x: 0, y: 0, ...this.arena() }
    );
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown($event: KeyboardEvent) {
    // Nor while a tap's work waits to run: Escape would back out of the
    // screen it belongs to, as the busy veil keeps a tap from doing.
    if (isTypingTarget($event.target) || this.busy.active()) {
      return;
    }
    // F is handled here rather than in the store: the fullscreen request has
    // to happen inside the key event, browsers reject it otherwise.
    if ($event.key.toLowerCase() === 'f' && !$event.repeat) {
      this.setFullscreen(!this.fullscreen());
      return;
    }
    // Escape, as in any game: pauses a match, backs out of a screen, and
    // only from the main menu leaves fullscreen for the page. The browser
    // takes its own fullscreen off on Escape before this runs.
    if ($event.key === 'Escape') {
      this.onEscape();
      return;
    }
    // The boost and weapon keys belong to the game only while a match is
    // on, and never while a button has the focus: a keyboard user pressing
    // Enter on "Reset" expects a reset, not a boost. Outside of a match
    // Space still scrolls. A weapon key counts only for a human who carries
    // a weapon; anyone else's E or Shift does what it did before.
    const inMatch =
      this.store.snapshot().currentState === GameState.RUNNING &&
      !isInteractiveTarget($event.target);
    const boosted = inMatch
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
    const armed = inMatch
      ? humanForWeaponKey(this.humans(), $event.key, $event.code)
      : null;
    if (armed != null) {
      $event.preventDefault();
      if (!$event.repeat) {
        this.gameStateService.fireWeapon(armed.id);
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

/** How long a match waits at most for the arena laid out for it. */
const ARENA_READY_MS = 2_000;

/** The screens of the menu that is shown while no match is on. */
export type MenuScreen =
  | 'menu'
  | 'new-game'
  | 'colony'
  | 'profile'
  | 'friends'
  | 'settings'
  | 'help'
  | 'evolution'
  | 'leaderboards'
  | 'my-matches'
  // The match just played, watched again from its result.
  | 'replay';

/** What is laid over the arena right now, nothing while a match is on. */
export type StagePanel = MenuScreen | 'pause' | 'over' | null;

/**
 * True while the key went to a control rather than to the game.
 *
 * Anything inside an overlay counts too: the level picker is a combobox whose
 * panel lives in the CDK overlay container, and typing a level name there must
 * not throw the page into fullscreen.
 */
/** Where the pointer is, in client pixels. */
/** The GPU self-test's verdict, as the canvas carries it. */
function selfTestState(result: GpuSelfTestResult | null): string {
  if (result == null) {
    return 'pending';
  }
  if (result.error != null) {
    return 'error';
  }
  return result.ok ? 'passed' : 'failed';
}

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

/** True on a device driven by touch, which opens the game fullscreen. */
function isTouchDevice(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  );
}
