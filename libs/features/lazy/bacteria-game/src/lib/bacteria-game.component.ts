import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { WsThanosDirective } from '@wolsok/thanos';
import { ElemResizedDirective } from '@wolsok/ui-kit';
import { trackScreenViews } from './analytics/screen-views';
import { reportUserProperties } from './analytics/user-properties';
import { ArenaViewComponent } from './arena/arena-view.component';
import { StageBusyComponent } from './busy/stage-busy.component';
import { CampaignService } from './campaign.service';
import { EvolutionService } from './evolution.service';
import { FeatureTogglesService } from './feature-toggles.service';
import { MatchEnd } from './flow/match-end';
import { MatchSetup } from './flow/match-setup';
import { OnlineFlow } from './flow/online-flow';
import { PlayFlow } from './flow/play-flow';
import type { GpuSelfTestResult } from './gl/gpu-self-test';
import { GpuSelfTestService } from './gl/gpu-self-test.service';
import { SimulationOverrideService } from './gl/simulation-override.service';
import { GameHapticsService } from './haptics.service';
import { MatchCountdownComponent } from './countdown/match-countdown.component';
import { HudBarComponent } from './hud-bar.component';
import { HudState } from './hud/hud-state';
import { I18nService } from './i18n/i18n.service';
import { TranslatePipe } from './i18n/translate.pipe';
import { EvolutionComponent } from './menu/evolution.component';
import { FriendsScreenComponent } from './menu/friends-screen.component';
import { HelpComponent } from './menu/help.component';
import { MainMenuComponent } from './menu/main-menu.component';
import { MyColonyComponent } from './menu/my-colony.component';
import { NewGameComponent } from './menu/new-game.component';
import { ProfileComponent } from './menu/profile.component';
import { SettingsComponent } from './menu/settings.component';
import { SwarmComponent } from './menu/swarm.component';
import { LeaderboardsComponent } from './boards/leaderboards.component';
import { ModerationNoticesComponent } from './moderation/moderation-notices.component';
import { ModerationService } from './moderation/moderation.service';
import { ProgressService } from './progress.service';
import { MyMatchesComponent } from './replays/my-matches.component';
import { ReplayScreenComponent } from './replays/replay-screen.component';
import { GameSettingsService } from './settings.service';
import { SocialNoticesComponent } from './social/social-notices.component';
import { SocialService } from './social/social.service';
import { STAGE_PROVIDERS } from './stage-providers';
import { GameSoundService, Soundtrack } from './sound/game-sound.service';
import { levelMusic } from './sound/level-music';
import { dismissSplash } from './splash';
import { ArenaStage } from './stage/arena-stage';
import { StageFrame } from './stage/stage-frame';
import { StageFullscreen } from './stage/stage-fullscreen';
import { StageInput } from './stage/stage-input';
import { TouchPadsComponent } from './stage/touch-pads.component';
import { GameStateService } from './state/game-state.service';
import { GameStateStore } from './state/game.states';
import { PlayerService } from './state/player.service';
import { WinnerComponent } from './winner-info/winner.component';

/**
 * The stage: the arena with its HUD, the touch pads, the menu screens and
 * the panels laid over it. It lays them out and wires its parts together -
 * the stage (`stage/`), the HUD's state (`hud/`) and the flows through the
 * game (`flow/`) - and keeps what joins several of them: the music, the
 * GPU self-test, Escape and the browser leaving fullscreen.
 */
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
    MatchCountdownComponent,
  ],
  templateUrl: './bacteria-game.component.html',
  // One of each per stage: they hold its view of the arena and its way
  // through the game.
  providers: STAGE_PROVIDERS,
  styleUrls: ['./bacteria-game.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The game speaks its own language, whatever the shell around it speaks.
  host: { '[attr.lang]': 'language()' },
})
export class BacteriaGameComponent implements AfterViewInit, OnDestroy {
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly playerService = inject(PlayerService);
  private readonly haptics = inject(GameHapticsService);
  private readonly gpuSelfTest = inject(GpuSelfTestService);
  private readonly simulationOverride = inject(SimulationOverrideService);
  private readonly featureToggles = inject(FeatureTogglesService);
  protected readonly language = inject(I18nService).language;
  protected readonly settings = inject(GameSettingsService);
  protected readonly sound = inject(GameSoundService);
  protected readonly progress = inject(ProgressService);
  protected readonly evolution = inject(EvolutionService);
  protected readonly campaign = inject(CampaignService);
  protected readonly social = inject(SocialService);
  /** The ban holding the player, and the owner's notices (ADR 0012). */
  protected readonly moderation = inject(ModerationService);
  /** False where the device cannot vibrate - the setting is left out then. */
  protected readonly vibrationSupported = this.haptics.supported;

  /** The stage's fullscreen, its arena, the arena's frames and the input. */
  protected readonly stageFullscreen = inject(StageFullscreen);
  protected readonly arenaStage = inject(ArenaStage);
  protected readonly stageFrame = inject(StageFrame);
  protected readonly stageInput = inject(StageInput);
  /** What the HUD and the panels show of the match and its setup. */
  protected readonly hud = inject(HudState);
  /** The screens, the modes and starting, pausing and clearing a match. */
  protected readonly flow = inject(PlayFlow);
  protected readonly setup = inject(MatchSetup);
  protected readonly onlineFlow = inject(OnlineFlow);
  protected readonly matchEnd = inject(MatchEnd);

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

  /**
   * What plays underneath: the level's music while the match is on, the
   * menu's between matches, and nothing on the pause menu and at the end
   * of a match.
   */
  private readonly soundtrack = computed<Soundtrack | null>(() => {
    const { running, underway, matchOver, level } = this.hud;
    // The level's music starts with the countdown, on the tap.
    if (underway()) {
      return levelMusic(level().id);
    }
    const inMenu = !running() && !matchOver() && !this.flow.resetting();
    return inMenu ? 'menu' : null;
  });

  constructor() {
    this.stageFullscreen.bind(() => this.stageRef?.nativeElement);
    this.arenaStage.bind({
      arenaView: this.arenaView,
      ambienceCanvas: this.ambienceRef,
      minimapCanvas: this.minimapRef,
      // Read on every use: the specs stand in for the template's parts.
      arenaFrame: () => this.arenaFrame(),
      thanos: () => this.thanos,
      declaring: this.flow.declaring,
    });
    trackScreenViews(
      computed(() =>
        this.flow.resetting() ? null : (this.flow.panel() ?? 'match')
      )
    );
    reportUserProperties();
    this.gameStateService.reset();
    // A series lasts for a visit of the page: one left unfinished last time
    // does not carry over.
    this.gameStateService.endSeries();
    this.onlineFlow.start();
    this.checkGpu();

    // A resumed match picks its music up where the match clock stands, so
    // it stays in step with a map that moves to it.
    effect(() => {
      const music = this.soundtrack();
      untracked(() =>
        this.sound.setMusic(music, this.store.snapshot().timePassed / 1000)
      );
    });
  }

  ngAfterViewInit(): void {
    dismissSplash(document);
    // The owner's toggles once the game is up: Remote Config stays off the
    // start, and the defaults hold until it answered.
    this.featureToggles.start();
    this.stageFullscreen.open();
  }

  ngOnDestroy(): void {
    this.gameStateService.leaveOnline();
    this.gameStateService.endSeries();
    this.gameStateService.cleanup();
    // The GPU simulation lives in this canvas's context, which goes with it.
    // The arena view disposes the painter.
    this.playerService.useSimulations(null);
    this.sound.setMusic(null);
    // Leaving the page must give the screen back as well.
    this.stageFullscreen.release();
  }

  /** Turns the sound on or off - with a tick to show it is on. */
  protected setSound(on: boolean): void {
    this.settings.set('sound', on);
    if (on) {
      this.sound.tick();
    }
  }

  /** Turns the sound effects on or off - with a tick to show they are on. */
  protected setEffects(on: boolean): void {
    this.settings.set('effects', on);
    if (on) {
      this.sound.tick();
    }
  }

  /** Turns the vibration on or off - with a buzz to show it is on. */
  protected setVibration(on: boolean): void {
    this.settings.set('vibration', on);
    if (on) {
      this.haptics.tap();
    } else {
      this.haptics.stop();
    }
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
    if (this.hud.playing()) {
      this.gameStateService.togglePause();
    } else if (this.hud.countingDown()) {
      // The match would start behind the page: it waits paused instead.
      this.gameStateService.pause();
    } else if (this.flow.panel() === 'menu') {
      this.stageFullscreen.leave();
    }
  }

  @HostListener('document:keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (this.stageInput.keyDown(event) === 'escape') {
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
    const { playing, paused, matchOver, countingDown } = this.hud;
    if (matchOver() || countingDown() || this.flow.resetting()) {
      return;
    }
    if (playing()) {
      this.flow.togglePause();
    } else if (this.flow.screen() !== 'menu') {
      this.flow.screen.set('menu');
    } else if (paused()) {
      this.flow.togglePause();
    } else {
      this.stageFullscreen.leave();
    }
  }

  /**
   * The GPU self-test runs once this device plays the deterministic
   * simulation: always with the owner's toggle on, else once the device
   * override opts it in (`?sim=gpu-int`) - from the URL at once, from the
   * storage maybe later than the arena. Ranked play needs its verdict as
   * well: ranked matches play gpu-int. The verdict goes on the canvas,
   * beside the simulation - for the e2e tests and for debugging.
   */
  private checkGpu(): void {
    this.simulationOverride.start();
    effect(() => {
      const toggles = this.featureToggles.toggles();
      if (
        toggles.deterministicSimulation ||
        toggles.rankedDaily ||
        toggles.rankedEndless ||
        this.simulationOverride.override() === 'gpu-int'
      ) {
        untracked(() => this.gpuSelfTest.check());
      }
    });
    effect(() => {
      const dataset = this.arenaView()?.canvas()?.dataset;
      if (dataset != null) {
        dataset['gpuSelfTest'] = selfTestState(this.gpuSelfTest.result());
      }
    });
  }
}

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
