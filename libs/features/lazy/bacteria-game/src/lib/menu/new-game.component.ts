import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { BASE_ARENA } from '../state/arena-size';
import { MedallionComponent } from '../medallion/medallion.component';
import {
  BOT_DIFFICULTIES,
  BotDifficulty,
  difficultyOption,
} from '../state/bot-controller';
import { ENDLESS_LIVES } from '../state/endless';
import { parseGeneratedId } from '../state/level-generator/generate-level';
import { RECIPES } from '../state/level-generator/recipes';
import {
  getLevel,
  isLadderLevel,
  Level,
  levelMap,
  levelTitle,
} from '../state/levels';
import { mapZones, ZONE_NAMES } from '../state/zones';
import { MEDAL_NAMES, medalGoal } from '../state/medallions';
import { Progress } from '../state/progress';
import {
  formatScore,
  HEAD_STARTS,
  HeadStart,
  headStartLabel,
  SERIES_LENGTHS,
  SeriesLength,
} from '../state/rivalry';
import { ruleNote, winRuleOf } from '../state/win-conditions';
import { LevelMapComponent } from './level-map.component';
import { OnlineLobbyComponent } from './online-lobby.component';
import { IDLE_LOBBY, OnlineLobby } from '../net/online-match.service';
import { DailyCard, endlessNote, levelColors } from './menu-cards';
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
 * A new game, step by step: first the mode - the campaign, the daily level,
 * an endless run, free play or two players - then only the steps that mode
 * needs: the level, where there is one to choose, and the start with the
 * opponent and a briefing.
 *
 * A dumb component - it shows what it is given and reports what the player
 * picks. The host sets the game up for a mode once it is picked.
 */
@Component({
  selector: 'feat-lazy-bac-game-new-game',
  imports: [
    LevelMapComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatStepperModule,
    MedallionComponent,
    OnlineLobbyComponent,
    ScreenHeaderComponent,
  ],
  templateUrl: './new-game.component.html',
  styleUrl: './new-game.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewGameComponent {
  /** The mode and the step the screen opens on. */
  public readonly entry = input<NewGameEntry>({ kind: null, step: 'mode' });
  public readonly difficulty = input.required<BotDifficulty>();
  /** The level the match will be played on. */
  public readonly levelId = input.required<string>();
  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});
  /** Why each locked level of the ladder is locked, by level id. */
  public readonly locks = input<Readonly<Record<string, string>>>({});
  /** "5 of 14 levels open" - the campaign so far. */
  public readonly campaignNote = input('');
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
  /** The lobby of an online match. */
  public readonly online = input<OnlineLobby>(IDLE_LOBBY);
  /** False where online matches cannot be played. */
  public readonly onlineAvailable = input(false);

  /** A mode was picked - the host sets the game up for it. */
  public readonly kindChange = output<PlayKind>();
  public readonly levelChange = output<string>();
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
  protected readonly difficulties = BOT_DIFFICULTIES;
  protected readonly seriesLengths = SERIES_LENGTHS;

  /** The modes, each with how far the player got in it. */
  protected readonly modes = computed(() =>
    PLAY_MODES.map((mode) => ({
      ...mode,
      note: this.modeNote(mode.kind),
    }))
  );

  protected readonly vsComputer = computed(
    () => this.kind() !== 'two-players' && this.kind() !== 'online'
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

  /** The id of the level the match is played on - none for a run. */
  private readonly briefedId = computed(() => {
    switch (this.kind()) {
      case 'endless':
        return null;
      case 'daily':
        return this.daily().levelId;
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
    return {
      level,
      // The ladder's number and name, or what was rolled.
      kicker:
        made === null
          ? level.name
          : `${RECIPES[made.recipe].label} · difficulty ${made.difficulty}`,
      ...levelColors(id),
      facts: levelFacts(level),
      title: levelTitle(level),
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
      bestName:
        best === null ? 'No medallion yet' : `${MEDAL_NAMES[best]} medallion`,
      goal:
        medalGoal(level.medal, best) ??
        'Every medallion of this level is yours.',
    };
  });

  /** The name and the briefing of the selected difficulty. */
  protected readonly difficultyOption = computed(() =>
    difficultyOption(this.difficulty())
  );

  /** The head starts on offer, named after the colony that gets it. */
  protected readonly headStarts = computed(() =>
    HEAD_STARTS.map((value) => ({
      value,
      label: headStartLabel(value, this.colonyNames()),
    }))
  );

  /** The lifetime score of the two colours, "Orange 14 : 9 Blue". */
  protected readonly rivalryLine = computed(() =>
    formatScore(this.colonyNames(), this.rivalry())
  );

  protected readonly endlessNote = endlessNote;
  protected readonly endlessLives = ENDLESS_LIVES;

  /** What the Start button says. */
  protected readonly startLabel = computed(() => {
    switch (this.kind()) {
      case 'endless':
        return 'Start the run';
      case 'daily':
        return 'Start the daily level';
      default:
        return `Start ${this.briefing()?.title ?? ''}`;
    }
  });

  /** Where the way back leads: the step before, or the main menu. */
  protected readonly backLabel = computed(() =>
    this.index() > 0 ? 'Back' : 'Menu'
  );

  /** Picks a mode and goes on to its next step. */
  protected pickKind(kind: PlayKind): void {
    this.kind.set(kind);
    this.kindChange.emit(kind);
    this.step.set(stepsOf(kind)[1]);
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

  /** The line under a mode: where the player stands in it. */
  private modeNote(kind: PlayKind): string {
    switch (kind) {
      case 'campaign':
        return this.campaignNote();
      case 'daily':
        return this.daily().note;
      case 'endless':
        return endlessNote(this.endlessBest());
      case 'free':
        return 'Any difficulty, any level';
      case 'two-players':
        return this.rivalryLine();
      case 'online':
        return this.onlineAvailable()
          ? 'A friend on another device'
          : 'Not in this build';
    }
  }
}

/** A line of the briefing - a rule or a zone - with the colour it shows in. */
interface LevelFact {
  label: string;
  color: string | null;
}

/** What sets a level apart besides its walls: its clock and its zones. */
function levelFacts(level: Level): LevelFact[] {
  const rule = ruleNote(winRuleOf(level));
  const kinds = new Set(
    mapZones(levelMap(level), BASE_ARENA.width, BASE_ARENA.height).map(
      (zone) => zone.kind
    )
  );
  return [
    ...(rule === null ? [] : [{ label: rule, color: null }]),
    ...[...kinds].map((kind) => ({
      label: ZONE_NAMES[kind],
      color: rgba(ZONE_COLORS[kind]),
    })),
  ];
}
