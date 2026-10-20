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
import { arenaTheme, cssTriple } from '../arena/arena-theme';
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
import { getLevel, Level, levelMap, levelTitle } from '../state/levels';
import { mapZones, ZoneKind } from '../state/zones';
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
import { DailyCard, endlessNote } from './menu-cards';
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
  /** Today's daily level, null where there is none. */
  public readonly daily = input<DailyCard | null>(null);
  /** The most levels beaten in one endless run. */
  public readonly endlessBest = input(0);

  /** A mode was picked - the host sets the game up for it. */
  public readonly kindChange = output<PlayKind>();
  public readonly levelChange = output<string>();
  public readonly difficultyChange = output<BotDifficulty>();
  public readonly seriesLengthChange = output<SeriesLength>();
  public readonly headStartChange = output<HeadStart>();
  /** Start the match - or the run - of the mode picked. */
  public readonly start = output<PlayKind>();
  public readonly back = output<void>();

  /** The mode picked, null until one is. */
  protected readonly kind = linkedSignal(() => this.entry().kind);
  protected readonly steps = computed(() => stepsOf(this.kind()));
  /** Where in the steps the player is. */
  protected readonly index = linkedSignal(() =>
    Math.max(0, stepsOf(this.entry().kind).indexOf(this.entry().step))
  );
  protected readonly step = computed(
    (): NewGameStep => this.steps()[this.index()] ?? 'mode'
  );
  protected readonly stepLabels = STEP_LABELS;
  protected readonly difficulties = BOT_DIFFICULTIES;
  protected readonly seriesLengths = SERIES_LENGTHS;

  /** The modes, each with how far the player got in it. */
  protected readonly modes = computed(() =>
    PLAY_MODES.map((mode) => ({
      ...mode,
      note: this.modeNote(mode.kind),
      disabled: mode.kind === 'daily' && this.daily() === null,
    }))
  );

  protected readonly vsComputer = computed(() => this.kind() !== 'two-players');

  /** The level the match is played on - none for an endless run. */
  protected readonly briefing = computed(() => {
    const kind = this.kind();
    if (kind === 'endless') {
      return null;
    }
    const id =
      kind === 'daily' ? (this.daily()?.levelId ?? null) : this.levelId();
    if (id === null) {
      return null;
    }
    const level = getLevel(id);
    const made = parseGeneratedId(id);
    const best = this.medals()[id]?.[this.difficulty()] ?? null;
    const theme = arenaTheme(id);
    return {
      level,
      // The ladder's number and name, or what was rolled.
      kicker:
        made === null
          ? level.name
          : `${RECIPES[made.recipe].label} · difficulty ${made.difficulty}`,
      floor: cssTriple(theme.floor),
      edge: cssTriple(theme.border),
      facts: levelFacts(level),
      title: levelTitle(level),
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
    this.index.set(1);
  }

  /** Picks a level and goes on to the start. */
  protected pickLevel(id: string): void {
    this.levelChange.emit(id);
    this.index.set(this.steps().indexOf('start'));
  }

  protected goTo(index: number): void {
    this.index.set(index);
  }

  protected next(): void {
    this.index.update((index) => Math.min(index + 1, this.steps().length - 1));
  }

  protected goBack(): void {
    if (this.index() === 0) {
      this.back.emit();
    } else {
      this.index.update((index) => index - 1);
    }
  }

  protected startGame(): void {
    const kind = this.kind();
    if (kind !== null) {
      this.start.emit(kind);
    }
  }

  /** The line under a mode: where the player stands in it. */
  private modeNote(kind: PlayKind): string {
    switch (kind) {
      case 'campaign':
        return this.campaignNote();
      case 'daily':
        return this.daily()?.note ?? 'Not today';
      case 'endless':
        return this.endlessBest() > 0
          ? `Best run: ${this.endlessBest()} levels`
          : `${ENDLESS_LIVES} lives`;
      case 'free':
        return 'Any difficulty, any level';
      case 'two-players':
        return this.rivalryLine();
    }
  }
}

/** A line of the briefing - a rule or a zone - with the colour it shows in. */
interface LevelFact {
  label: string;
  color: string | null;
}

const ZONE_NAMES: Readonly<Record<ZoneKind, string>> = {
  antibiotic: 'Antibiotic',
  agar: 'Agar',
  ice: 'Ice',
  heat: 'Heat',
};

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
