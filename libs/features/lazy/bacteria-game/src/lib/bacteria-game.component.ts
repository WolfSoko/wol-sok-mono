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
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WsThanosDirective } from '@wolsok/thanos';
import { trackScreenViews } from './analytics/screen-views';
import { reportUserProperties } from './analytics/user-properties';
import { TranslationKey } from './i18n/dictionaries';
import { I18nService } from './i18n/i18n.service';
import { difficultyKeys, levelNameText, missionKeys } from './i18n/game-texts';
import { TranslatePipe } from './i18n/translate.pipe';
import { ElemResizedDirective } from '@wolsok/ui-kit';
import { defer, Observable, of } from 'rxjs';
import {
  catchError,
  defaultIfEmpty,
  filter,
  last,
  map,
  tap,
} from 'rxjs/operators';
import { ArenaViewComponent } from './arena/arena-view.component';
import { armedTap } from './armed-tap';
import { StageBusyComponent } from './busy/stage-busy.component';
import { StageBusy } from './busy/stage-busy';
import type { GpuSelfTestResult } from './gl/gpu-self-test';
import { GpuSelfTestService } from './gl/gpu-self-test.service';
import { SimulationOverrideService } from './gl/simulation-override.service';
import { FeatureTogglesService } from './feature-toggles.service';
import { cssTriple } from './arena/arena-theme';
import { rgba } from './arena/canvas-math';
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
import { SwarmComponent } from './menu/swarm.component';
import {
  getColonyColor,
  NEUTRAL_COLOR,
  pickColor,
  readableOn,
} from './state/colony-colors';
import { BotDifficulty } from './state/bot-controller';
import { GameSettingsService } from './settings.service';
import { ProgressService } from './progress.service';
import { EvolutionService } from './evolution.service';
import { CampaignService } from './campaign.service';
import { dismissSplash } from './splash';
import { HeadStart, rivalryScore, SeriesLength } from './state/rivalry';
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
import { GameHapticsService } from './haptics.service';
import { GameSoundService, Soundtrack } from './sound/game-sound.service';
import { MatchResult } from './state/match-engine';
import { levelMusic } from './sound/level-music';
import { ColonyStats, sameColonyStats, toColonyStats } from './colony-stats';
import { HudBarComponent, HudGoal } from './hud-bar.component';
import { clock } from './state/fixed-tick';
import { GameStateService } from './state/game-state.service';
import { GameMode, GameStateStore } from './state/game.states';
import { getLevel, Level, ONLINE_LOCKS, nextLevel } from './state/levels';
import { pickMatchLevel } from './state/match-level';
import { isRunOver } from './state/endless';
import { harvestTarget, holdTarget } from './state/win-conditions';
import { MissionId } from './state/training';
import { PlayerStore } from './state/player.store';
import { PlayerService } from './state/player.service';
import {
  MatchEndAction,
  WinnerComponent,
} from './winner-info/winner.component';
import { ArenaStage } from './stage/arena-stage';
import { StageFrame } from './stage/stage-frame';
import { StageFullscreen } from './stage/stage-fullscreen';
import { StageInput } from './stage/stage-input';
import { TouchPadsComponent } from './stage/touch-pads.component';

/** The last seconds of a timed level, when its clock turns red. */
const RUNNING_OUT_SEC = 10;

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
    TouchPadsComponent,
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
  // One of each per stage: they hold its view of the arena.
  providers: [StageFullscreen, ArenaStage, StageFrame, StageInput],
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
  /** The stage's fullscreen, its arena, the arena's frames and the input. */
  protected readonly stageFullscreen = inject(StageFullscreen);
  protected readonly arenaStage = inject(ArenaStage);
  protected readonly stageFrame = inject(StageFrame);
  protected readonly stageInput = inject(StageInput);

  /**
   * The arena on its canvas. A new resolution gets a new canvas - see
   * `ArenaStage.arenaLayout` - which is when the painter is built again.
   */
  private readonly arenaView = viewChild(ArenaViewComponent);
  private readonly ambienceRef =
    viewChild<ElementRef<HTMLCanvasElement>>('ambienceElement');
  private readonly minimapRef =
    viewChild<ElementRef<HTMLCanvasElement>>('minimapElement');
  @ViewChild('stageElement', { static: true })
  private stageRef!: ElementRef<HTMLElement>;
  @ViewChild(WsThanosDirective, { static: true })
  private thanos!: WsThanosDirective;
  /**
   * The frame around the arena canvas, inside the vaporized container -
   * hidden from the end of the effect until the stage shows what comes
   * next, see `ArenaStage.hideUntilPainted`. Missing where the template is
   * not rendered, as in the specs.
   */
  private readonly arenaFrame =
    viewChild<ElementRef<HTMLElement>>('arenaFrame');

  /** The arena in cells, for the settings and the start of a match. */
  protected readonly arena = this.arenaStage.arena;

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
  /** False where the device cannot vibrate - the setting is left out then. */
  protected readonly vibrationSupported = this.haptics.supported;

  /** The level the next match is played on. */
  protected readonly level: Signal<Level>;
  /** Its name in the HUD: "3 · Hourglass". */
  protected readonly levelName = computed(() => levelNameText(this.level()));
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

  constructor() {
    this.stageFullscreen.bind(() => this.stageRef?.nativeElement);
    this.arenaStage.bind({
      arenaView: this.arenaView,
      ambienceCanvas: this.ambienceRef,
      minimapCanvas: this.minimapRef,
      // Read on every use: the specs stand in for the template's parts.
      arenaFrame: () => this.arenaFrame(),
      thanos: () => this.thanos,
      declaring: this.declaring,
    });
    trackScreenViews(
      computed(() => (this.resetting() ? null : (this.panel() ?? 'match')))
    );
    reportUserProperties();
    this.gameStateService.reset();
    // A series lasts for a visit of the page: one left unfinished last time
    // does not carry over.
    this.gameStateService.endSeries();

    this.level = this.store.level;
    this.upcomingLevel = computed(() => nextLevel(this.level().id));
    void this.takeChallenge();
    void this.takeInvite();

    this.mode = this.store.mode;
    this.colors = this.store.colors;
    this.difficulty = this.store.difficulty;

    const players = this.playerStore.entities;
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
    const balance = this.arenaStage.balance;
    this.stats = computed(() => toColonyStats(named(), balance()), {
      equal: sameColonyStats,
    });
    this.neutralCount = this.playerStore.neutralCount;
    this.humanStats = computed(() =>
      this.stats().filter((colony) => !colony.isBot)
    );

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
    await this.arenaStage.whenReady();
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
    this.stageFullscreen.requestNative();
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

  ngAfterViewInit(): void {
    dismissSplash(document);
    // The owner's toggles once the game is up: Remote Config stays off the
    // start, and the defaults hold until it answered.
    this.featureTogglesService.start();
    this.stageFullscreen.open();
  }

  /**
   * The window's size changed: the embedded stage fills the viewport below
   * where it starts, which may have moved.
   */
  @HostListener('window:resize')
  protected onResize(): void {
    this.stageFullscreen.measureStageTop();
  }

  /**
   * Clears the arena and starts a fresh match. The tap on Start is the one
   * gesture nearly every session makes, so it also takes the screen.
   */
  startGame() {
    // A match started from the level choice backs out to the main menu.
    this.screen.set('menu');
    this.stageFullscreen.requestNative();
    this.sound.matchStart(levelMusic(this.level().id));
    this.haptics.matchStart();
    this.stageFrame.newMatch();
    this.gameStateService.cleanup();
    this.gameStateService.init(this.arena().width, this.arena().height);
    this.gameStateService.start();
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
   * An effect that fails - even at once, while `ArenaStage.vaporize` sets it up -
   * is over too: the error is logged here and the reset goes on, so
   * `resetting` never sticks.
   */
  private resetGame$(): Observable<void> {
    return defer(() => {
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
          // up again), the stage gets its menu back and a pending online
          // start is taken up; the error goes on. The signal first, so the
          // change detection it schedules is registered before the
          // repaint's animation frame.
          this.resetting.set(false);
          afterNextRender(() => this.arenaStage.stageRenderedAfterReset(), {
            injector: this.injector,
          });
          this.arenaStage.draw();
          if (this.onlineStartPending) {
            this.onlineStartPending = false;
            this.startOnlineMatch();
          }
        }
      }),
      map(() => undefined)
    );
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
    this.stageFullscreen.release();
  }

  /** Toggles pause - the touch equivalent of the P key. */
  togglePause() {
    // A ranked match plays through: the music too.
    if (!this.paused() && !this.canPause()) {
      return;
    }
    this.stageFullscreen.requestNative();
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

  /**
   * Follows the browser's fullscreen. Once it takes the stage off - Escape,
   * the back gesture, a system dialog, the settings toggle - the game reacts
   * as it does to Escape, which the browser consumes before it reaches
   * {@link onKeyDown}: a running match pauses, a screen stays open, and only
   * the main menu leaves for the page.
   */
  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  protected onFullscreenChange(): void {
    if (!this.stageFullscreen.followBrowser()) {
      return;
    }
    if (this.running() && !this.paused()) {
      this.gameStateService.togglePause();
    } else if (this.panel() === 'menu') {
      this.stageFullscreen.leave();
    }
  }

  @HostListener('document:keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (this.stageInput.keyDown(event)) {
      this.onEscape();
    }
  }

  @HostListener('document:keyup', ['$event'])
  public onKeyUp(event: KeyboardEvent): void {
    this.stageInput.keyUp(event);
  }

  /**
   * Escape, as in any game: pauses a match, backs out of a screen, and only
   * from the main menu leaves fullscreen for the page.
   */
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
      this.stageFullscreen.leave();
    }
  }
}

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
