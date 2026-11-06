import { computed, inject, Injectable, Signal } from '@angular/core';
import { cssTriple } from '../arena/arena-theme';
import { rgba } from '../arena/canvas-math';
import { CampaignService } from '../campaign.service';
import { ColonyStats, sameColonyStats, toColonyStats } from '../colony-stats';
import type { HudGoal } from '../hud-bar.component';
import {
  getColonyColor,
  getLevel,
  harvestTarget,
  holdTarget,
  NEUTRAL_COLOR,
  nextLevel,
  ONLINE_LOCKS,
  readableOn,
  rivalryScore,
  type TranslationKey,
} from '@wolsok/feat-shared-bacteria-engine';
import { difficultyKeys, levelNameText, missionKeys } from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { ProgressService } from '../progress.service';
import { GameSettingsService } from '../settings.service';
import { SocialService } from '../social/social.service';
import { ArenaStage } from '../stage/arena-stage';
import { GameStateStore } from '../state/game.states';
import { PlayerStore } from '../state/player.store';
import {
  isTimeRunningOut,
  matchClockLabel,
  matchClockText,
} from './match-clock';

/** An RGB triple of a colony colour. */
type Rgb = readonly [number, number, number];

/**
 * What the stage shows of the match and its setup: the HUD's scoreboard,
 * clock and goal, the level and its names, the colony colours, and what
 * the pause menu and the result screen offer. Read-only: it changes
 * nothing. Provided by the stage component, one per stage.
 */
@Injectable()
export class HudState {
  private readonly store = inject(GameStateStore);
  private readonly i18n = inject(I18nService);
  private readonly settings = inject(GameSettingsService);
  private readonly playerStore = inject(PlayerStore);
  private readonly social = inject(SocialService);
  private readonly progress = inject(ProgressService);
  private readonly campaign = inject(CampaignService);
  private readonly arenaStage = inject(ArenaStage);

  /** True while a match is on, paused or not. */
  public readonly running = this.store.isMatchOn;
  public readonly paused = this.store.isPaused;
  /** True while a match is on and not paused: the war plays. */
  public readonly playing = computed(() => this.running() && !this.paused());
  /** True once a match is over and its result is shown, until the next one. */
  public readonly matchOver = this.store.matchEnded;
  /** True while an online match waits for the other device. */
  public readonly waitingForPeer = this.store.waitingForPeer;
  /** This device's seat in an online match, null outside one. */
  public readonly onlineSeat = computed(
    () => this.store.online()?.seat ?? null
  );
  /** True in a match of an endless run - no restart, it would cost no life. */
  public readonly inEndlessRun = this.store.endlessMatch;

  /** The level the next match is played on. */
  public readonly level = this.store.level;
  /** Its name in the HUD: "3 · Hourglass". */
  public readonly levelName = computed(() => levelNameText(this.level()));
  /** The level that follows the selected one, null at the end of the list. */
  public readonly upcomingLevel = computed(() => nextLevel(this.level().id));
  /** The level of a run someone shared in a link, null without one. */
  public readonly challengeLevel = computed(() => {
    const run = this.store.challenge();
    return run === null ? null : getLevel(run.header.levelId);
  });
  /** Two humans or one human against the computer. */
  public readonly mode = this.store.mode;
  /** How hard the computer plays. */
  public readonly difficulty = this.store.difficulty;
  /** The name of the computer's difficulty, for the menu's summary line. */
  public readonly difficultyName = computed(() =>
    this.i18n.t(difficultyKeys(this.difficulty()).name)
  );

  /**
   * The scoreboard. The crosshairs move the players every frame - it only
   * changes once one of its numbers does. Online, the other colony goes by
   * its player's name, once their profile is in - it may come after the
   * match started.
   */
  public readonly stats: Signal<ColonyStats[]> = computed(
    () => toColonyStats(this.namedPlayers(), this.arenaStage.balance()),
    { equal: sameColonyStats }
  );
  /** The colonies a finger may steer - one seat each in the touch layout. */
  public readonly humanStats = computed(() =>
    this.stats().filter((colony) => !colony.isBot)
  );
  /** The neutral colonies' bacteria, null on a level without any. */
  public readonly neutralCount = this.playerStore.neutralCount;
  /** The grey the neutral colonies are drawn in. */
  public readonly neutralCss = `rgb(${cssTriple([
    NEUTRAL_COLOR[0],
    NEUTRAL_COLOR[1],
    NEUTRAL_COLOR[2],
  ])})`;
  /**
   * The frame rate in the HUD, in whole frames - null while the settings
   * hide it, so the HUD renders again only when the number it shows changes.
   */
  public readonly hudFps = computed(() =>
    this.settings.value('showFps') ? Math.round(this.store.fps()) : null
  );

  /** What the match clock shows, once a second - "1:05". */
  public readonly clockText = computed(() =>
    matchClockText(this.store.secondsLeft(), this.store.gameSeconds())
  );
  /** What the clock tells - the time left or the time played. */
  public readonly clockLabel = computed(() =>
    this.i18n.t(matchClockLabel(this.store.secondsLeft()))
  );
  /** True in the last seconds of a timed match, while it is on. */
  public readonly timeRunningOut = computed(() =>
    isTimeRunningOut(this.running(), this.store.secondsLeft())
  );
  /**
   * What a colony counts up towards on a level won by reaching a goal - the
   * seconds on the zone, the pellets eaten - null on any other level.
   */
  public readonly goal = computed((): HudGoal | null => {
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
  public readonly missionGoal = computed((): TranslationKey | null => {
    const { mission } = this.store.level();
    return mission === undefined ? null : missionKeys(mission).goal;
  });

  /** The colour ids of the left and the right colony. */
  public readonly colors = this.store.colors;
  /** The names of the left and the right colour, for the help texts. */
  public readonly colorNames = computed((): [string, string] => {
    const [left, right] = this.colors();
    return [getColonyColor(left).name, getColonyColor(right).name];
  });
  /** The lifetime wins of the two colours between two players. */
  public readonly rivalry = computed(() =>
    rivalryScore(this.progress.couchWins(), this.colors())
  );
  /**
   * The colony colours as RGB and as CSS, with a text colour that reads on
   * the player's - for the menu screens. Online the player's colour is
   * their seat's in the match, which for the guest is the right one.
   */
  public readonly colonyRgb = computed(
    () =>
      this.store.playerColors().map((id) => getColonyColor(id).rgb) as [
        Rgb,
        Rgb,
      ]
  );
  public readonly colonyCss = computed(() =>
    this.colonyRgb().map((rgb) => rgba(rgb))
  );
  public readonly onPlayerColor = computed(() =>
    readableOn(this.colonyRgb()[0])
  );

  /** Why the level after the selected one is locked, null when it is open. */
  public readonly upcomingLock = computed(() => {
    const upcoming = this.upcomingLevel();
    const locks =
      this.store.online() === null ? this.campaign.locks() : ONLINE_LOCKS;
    return upcoming === null ? null : (locks[upcoming.id] ?? null);
  });
  /**
   * True where Restart may start the match again - online, the host only;
   * never a ranked match, whose declared seed plays once.
   */
  public readonly canRestart = computed(
    () =>
      !this.inEndlessRun() &&
      this.store.rankedMatch() === null &&
      this.onlineSeat() !== 1
  );
  /**
   * True where the match may be paused: never a ranked one, whose attempt
   * has a deadline from its declaration on (ADR 0012).
   */
  public readonly canPause = computed(() => this.store.rankedMatch() === null);

  /** The players, the online opponent under their profile's name. */
  private readonly namedPlayers = computed(() => {
    const players = this.playerStore.entities();
    const online = this.store.online();
    const name = this.social.opponent()?.card.name;
    return online === null || name === undefined
      ? players
      : players.map((player) =>
          player.id === online.seat ? player : { ...player, name }
        );
  });
}
