import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { rgba } from '../arena/canvas-math';
import { ZONE_COLORS } from '../arena/zone-look';
import {
  difficultyKeys,
  GameText,
  levelDescriptionText,
  levelNameText,
  levelTitleText,
  medalGoalText,
  medalKey,
  missionKeys,
  playerNameText,
  recipeKeys,
  renderGameText,
  ruleNoteText,
  seriesKey,
  zoneKey,
} from '../i18n/game-texts';
import { EvolutionService } from '../evolution.service';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BASE_ARENA } from '../state/arena-size';
import { MedallionComponent } from '../medallion/medallion.component';
import { BOT_DIFFICULTIES, BotDifficulty } from '../state/bot-controller';
import { computerLoadout } from '../state/computer-opponent';
import { isDailyLevelId } from '../state/daily';
import { geneLevel, GENES, isPlainLoadout } from '../state/evolution';
import { ENDLESS_LIVES } from '../state/endless';
import { parseGeneratedId } from '../state/level-generator/generate-level';
import {
  getLevel,
  isLadderLevel,
  Level,
  LEVELS,
  levelMap,
  levelSize,
} from '../state/levels';
import { mapZones } from '../state/zones';
import { Progress } from '../state/progress';
import {
  HEAD_STARTS,
  HeadStart,
  SERIES_LENGTHS,
  SeriesLength,
} from '../state/rivalry';
import { winRuleOf } from '../state/win-conditions';
import { geneKeys, weaponKeys } from './evolution-look';
import {
  firstOpenMission,
  isMissionDone,
  MissionId,
  missionById,
  MISSIONS,
  missionsDone,
} from '../state/training';
import { LevelMapComponent } from './level-map.component';
import { LevelPreviewComponent } from './level-preview.component';
import { LevelPreviewService } from './level-preview.service';
import { OnlineLobbyComponent } from './online-lobby.component';
import { IDLE_LOBBY, OnlineLobby } from '../net/online-match.service';
import {
  DailyCard,
  dailyNoteText,
  endlessNoteText,
  levelColors,
} from './menu-cards';
import {
  NewGameEntry,
  NewGameStep,
  PLAY_MODES,
  PlayKind,
  STEP_LABELS,
  stepsOf,
} from './play-modes';
import { ScreenHeaderComponent } from './screen-header.component';

/**
 * A new game, step by step: first the mode - the training, the campaign,
 * the daily level, an endless run, free play or two players - then only the
 * steps that mode needs: the level, where there is one to choose - the
 * training's mission - and the start with the opponent and a briefing.
 *
 * A dumb component - it shows what it is given and reports what the player
 * picks. The host sets the game up for a mode once it is picked.
 */
@Component({
  selector: 'feat-lazy-bac-game-new-game',
  imports: [
    LevelMapComponent,
    LevelPreviewComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatStepperModule,
    MedallionComponent,
    OnlineLobbyComponent,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './new-game.component.html',
  styleUrl: './new-game.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewGameComponent {
  private readonly i18n = inject(I18nService);
  /** True where the briefing shows a picture of the level's map. */
  protected readonly previews = inject(LevelPreviewService).supported;
  /**
   * False for the few moments after the app opened or a sign-in, until the
   * storage told what the player evolved - Start waits for it.
   */
  protected readonly startReady = inject(EvolutionService).settled;

  /** The mode and the step the screen opens on. */
  public readonly entry = input<NewGameEntry>({ kind: null, step: 'mode' });
  public readonly difficulty = input.required<BotDifficulty>();
  /** The level the match will be played on. */
  public readonly levelId = input.required<string>();
  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});
  /** Why each locked level of the ladder is locked, by level id. */
  public readonly locks = input<Readonly<Record<string, string>>>({});
  /** The levels of the ladder open so far - the campaign's note. */
  public readonly openLevels = input(0);
  /** Between two players: how many matches a series is the best of. */
  public readonly seriesLength = input<SeriesLength>(1);
  /** Between two players: who starts bigger. */
  public readonly headStart = input<HeadStart>(0);
  /** The names of the left and the right colony. */
  public readonly colonyNames = input<readonly [string, string]>([
    'Left',
    'Right',
  ]);
  /** The lifetime wins of the two colonies' colours - the rivalry. */
  public readonly rivalry = input<readonly [number, number]>([0, 0]);
  /** Today's daily level. */
  public readonly daily = input.required<DailyCard>();
  /** The most levels beaten in one endless run. */
  public readonly endlessBest = input(0);
  /** The training mission picked. */
  public readonly missionId = input<MissionId>('steer');
  /** The day each training mission was done. */
  public readonly training = input<Progress['training']>({});
  /** The lobby of an online match. */
  public readonly online = input<OnlineLobby>(IDLE_LOBBY);
  /** False where online matches cannot be played. */
  public readonly onlineAvailable = input(false);

  /** A mode was picked - the host sets the game up for it. */
  public readonly kindChange = output<PlayKind>();
  public readonly levelChange = output<string>();
  public readonly missionChange = output<MissionId>();
  public readonly difficultyChange = output<BotDifficulty>();
  public readonly seriesLengthChange = output<SeriesLength>();
  public readonly headStartChange = output<HeadStart>();
  /** Start the match - or the run - of the mode picked. */
  public readonly start = output<PlayKind>();
  public readonly hostOnline = output<void>();
  public readonly joinOnline = output<string>();
  public readonly leaveOnline = output<void>();
  public readonly back = output<void>();

  /** The mode picked, null until one is. */
  protected readonly kind = linkedSignal(() => this.entry().kind);
  protected readonly steps = computed(() => stepsOf(this.kind()));
  /** The step the player is on - one the mode has, else its first. */
  protected readonly step = linkedSignal((): NewGameStep => this.entry().step);
  /** Where in the mode's steps that is, for the stepper. */
  protected readonly index = computed(() =>
    Math.max(0, this.steps().indexOf(this.step()))
  );
  protected readonly stepLabels = STEP_LABELS;
  protected readonly difficulties = BOT_DIFFICULTIES.map(({ id }) => ({
    id,
    name: difficultyKeys(id).name,
  }));
  protected readonly seriesLengths = SERIES_LENGTHS.map(({ id }) => ({
    id,
    name: seriesKey(id),
  }));

  /** The modes, each with how far the player got in it. */
  protected readonly modes = computed(() =>
    PLAY_MODES.map((mode) => ({
      ...mode,
      note: this.modeNote(mode.kind),
    }))
  );

  /** The colonies' names in the active language - online ones as they are. */
  private readonly names = computed((): readonly [string, string] => {
    const [left, right] = this.colonyNames();
    return [this.name(left), this.name(right)];
  });

  /**
   * True where the computer's difficulty is picked: against the computer,
   * on a level without an opponent of its own - a training mission's.
   */
  protected readonly vsComputer = computed(
    () =>
      this.kind() !== 'two-players' &&
      this.kind() !== 'online' &&
      this.briefing()?.level.opponent === undefined
  );

  /**
   * True while the Start button may start: always, but online only for
   * the host, once the guest is there.
   */
  protected readonly canStart = computed(() => {
    if (this.kind() !== 'online') {
      return true;
    }
    const { phase, role } = this.online();
    return phase === 'connected' && role === 'host';
  });

  /**
   * The training's missions, each with whether it is done - and the one to
   * play next marked, the first still to do.
   */
  protected readonly missions = computed(() => {
    const days = this.training();
    const upNext = firstOpenMission(days);
    return MISSIONS.map((mission, index) => ({
      ...mission,
      ...missionKeys(mission.id),
      number: index + 1,
      done: isMissionDone(days, mission.id),
      upNext: mission.id === upNext && !isMissionDone(days, mission.id),
    }));
  });

  protected readonly missionCount = MISSIONS.length;

  /** The missions done, for the training's line. */
  protected readonly missionsDone = computed(() =>
    missionsDone(this.training())
  );

  /** The mission picked, as its briefing tells it - null outside the training. */
  protected readonly mission = computed(() => {
    if (this.kind() !== 'training') {
      return null;
    }
    const { goal, tip } = missionKeys(this.missionId());
    return {
      goal,
      tip,
      opponent:
        this.briefing()?.level.opponent === 'dummy'
          ? ('training.opponents.dummy' as const)
          : ('training.opponents.computer' as const),
    };
  });

  /** The id of the level the match is played on - none for a run. */
  private readonly briefedId = computed(() => {
    switch (this.kind()) {
      case 'endless':
        return null;
      case 'daily':
        return this.daily().levelId;
      case 'training':
        return missionById(this.missionId()).levelId;
      default:
        return this.levelId();
    }
  });

  /** The level the match is played on, as the briefing tells it. */
  protected readonly briefing = computed(() => {
    const id = this.briefedId();
    if (id === null) {
      return null;
    }
    const level = getLevel(id);
    const made = parseGeneratedId(id);
    const { mission } = level;
    return {
      id,
      level,
      size: levelSize(level),
      // The ladder's number and name, the mission's, or what was rolled.
      kicker: this.text(
        mission !== undefined
          ? {
              key: 'training.kicker',
              params: {
                number: MISSIONS.indexOf(missionById(mission)) + 1,
                total: this.missionCount,
              },
            }
          : made === null
            ? levelNameText(level)
            : {
                key: 'newGame.generatedKicker',
                params: {
                  style: { key: recipeKeys(made.recipe).label },
                  difficulty: made.difficulty,
                },
              }
      ),
      ...levelColors(id),
      facts: levelFacts(level).map(({ label, color }) => ({
        label: this.text(label),
        color,
      })),
      title: this.text(levelTitleText(level)),
      description: this.text(levelDescriptionText(level)),
    };
  });

  /**
   * The best medallion of that level at the difficulty picked, and what
   * the next one needs - apart, so a new difficulty leaves the rest be.
   */
  protected readonly standing = computed(() => {
    const brief = this.briefing();
    if (brief === null) {
      return null;
    }
    const { level } = brief;
    // A rolled level keeps no medallion - only the daily one does.
    if (!isLadderLevel(level.id) && this.kind() !== 'daily') {
      return null;
    }
    const best = this.medals()[level.id]?.[this.difficulty()] ?? null;
    return {
      best,
      bestName: this.text(
        best === null
          ? { key: 'common.noMedal' }
          : { key: 'common.medal', params: { medal: { key: medalKey(best) } } }
      ),
      goal: this.text(
        medalGoalText(level.medal, best) ?? { key: 'newGame.allMedals' }
      ),
    };
  });

  /**
   * What the computer evolved on the level and difficulty picked - "The
   * enemy evolved: Venom Glands 3, Cryo Pulse" - where evolution plays: on
   * the campaign and in free play, not on the daily level (ADR 0016).
   */
  protected readonly enemyEvolution = computed(() => {
    const id = this.briefedId();
    const kind = this.kind();
    if (
      id === null ||
      (kind !== 'campaign' && kind !== 'free') ||
      isDailyLevelId(id)
    ) {
      return null;
    }
    const loadout = computerLoadout(id, this.difficulty());
    if (isPlainLoadout(loadout)) {
      return this.i18n.t('newGame.enemy.plain');
    }
    const parts = GENES.filter(
      ({ id: gene }) => geneLevel(loadout, gene) > 0
    ).map(({ id: gene }) =>
      this.i18n.t('newGame.enemy.gene', {
        name: this.i18n.t(geneKeys(gene).name),
        level: geneLevel(loadout, gene),
      })
    );
    if (loadout.weapon !== null) {
      parts.push(this.i18n.t(weaponKeys(loadout.weapon).name));
    }
    return this.i18n.t('newGame.enemy.evolved', { list: parts.join(', ') });
  });

  /** The keys of the name and the briefing of the selected difficulty. */
  protected readonly difficultyTexts = computed(() =>
    difficultyKeys(this.difficulty())
  );

  /** The head starts on offer, named after the colony that gets it. */
  protected readonly headStarts = computed(() =>
    HEAD_STARTS.map((value) => ({
      value,
      label:
        value === 0
          ? this.i18n.t('newGame.headStart.even')
          : this.i18n.t('newGame.headStart.ahead', {
              name: this.names()[value < 0 ? 0 : 1],
              steps: '+'.repeat(Math.abs(value)),
            }),
    }))
  );

  /** The lifetime score of the two colours, "Orange 14 : 9 Blue". */
  protected readonly rivalryLine = computed(() => {
    const [left, right] = this.names();
    const [leftWins, rightWins] = this.rivalry();
    return this.i18n.t('newGame.score', { left, leftWins, rightWins, right });
  });

  protected readonly endlessLives = ENDLESS_LIVES;

  /** What the Start button says. */
  protected readonly startLabel = computed(() => {
    switch (this.kind()) {
      case 'endless':
        return this.i18n.t('newGame.start.run');
      case 'daily':
        return this.i18n.t('newGame.start.daily');
      default:
        return this.i18n.t('newGame.start.level', {
          title: this.briefing()?.title ?? '',
        });
    }
  });

  /** Where the way back leads: the step before, or the main menu. */
  protected readonly backLabel = computed(() =>
    this.i18n.t(this.index() > 0 ? 'common.back' : 'common.menu')
  );

  /** Picks a mode and goes on to its next step. */
  protected pickKind(kind: PlayKind): void {
    this.kind.set(kind);
    this.kindChange.emit(kind);
    this.step.set(stepsOf(kind)[1]);
  }

  /** Picks a training mission and goes on to its start. */
  protected pickMission(id: MissionId): void {
    this.missionChange.emit(id);
    this.step.set('start');
  }

  /** Picks a level and goes on to the start. */
  protected pickLevel(id: string): void {
    this.levelChange.emit(id);
    this.step.set('start');
  }

  protected goTo(index: number): void {
    this.step.set(this.steps()[index] ?? 'mode');
  }

  protected next(): void {
    this.goTo(Math.min(this.index() + 1, this.steps().length - 1));
  }

  protected goBack(): void {
    if (this.index() === 0) {
      this.back.emit();
    } else {
      this.goTo(this.index() - 1);
    }
  }

  protected startGame(): void {
    const kind = this.kind();
    if (kind !== null && this.canStart()) {
      this.start.emit(kind);
    }
  }

  /** The line under the daily level: attempts left and the streak. */
  protected readonly dailyNote = computed(() =>
    this.text(dailyNoteText(this.daily()))
  );

  /** The line under a mode: where the player stands in it. */
  private modeNote(kind: PlayKind): string {
    switch (kind) {
      case 'training':
        return this.i18n.t('training.progress', {
          done: this.missionsDone(),
          total: this.missionCount,
        });
      case 'campaign':
        return this.i18n.t('newGame.notes.campaign', {
          open: this.openLevels(),
          total: LEVELS.length,
        });
      case 'daily':
        return this.dailyNote();
      case 'endless':
        return this.text(endlessNoteText(this.endlessBest()));
      case 'free':
        return this.i18n.t('newGame.notes.free');
      case 'two-players':
        return this.rivalryLine();
      case 'online':
        return this.i18n.t(
          this.onlineAvailable()
            ? 'newGame.notes.online'
            : 'newGame.notes.offline'
        );
    }
  }

  /** A game text in the active language - a computed calling it follows a switch. */
  private text(text: GameText): string {
    return renderGameText(text, (key, params) => this.i18n.t(key, params));
  }

  /** A colony's name in the active language: "Orange", "You" - others as they are. */
  private name(name: string): string {
    const text = playerNameText(name);
    return text === null ? name : this.text(text);
  }
}

/** A line of the briefing - a rule or a zone - with the colour it shows in. */
interface LevelFact {
  label: GameText;
  color: string | null;
}

/** What sets a level apart besides its walls: its clock and its zones. */
function levelFacts(level: Level): LevelFact[] {
  const rule = ruleNoteText(winRuleOf(level));
  const kinds = new Set(
    mapZones(levelMap(level), BASE_ARENA.width, BASE_ARENA.height).map(
      (zone) => zone.kind
    )
  );
  return [
    ...(rule === null ? [] : [{ label: rule, color: null }]),
    ...[...kinds].map((kind) => ({
      label: { key: zoneKey(kind) },
      color: rgba(ZONE_COLORS[kind]),
    })),
  ];
}
