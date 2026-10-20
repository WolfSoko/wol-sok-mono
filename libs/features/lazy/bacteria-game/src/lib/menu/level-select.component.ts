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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { arenaTheme, cssTriple } from '../arena/arena-theme';
import { CHAPTERS } from '../state/chapters';
import {
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  parseGeneratedId,
  rollLevelId,
} from '../state/level-generator/generate-level';
import {
  RECIPE_IDS,
  RecipeId,
  RECIPES,
} from '../state/level-generator/recipes';
import { DailyCard, endlessNote } from './menu-cards';
import { LevelCard, LevelCardComponent } from './level-card.component';
import { MedallionComponent } from '../medallion/medallion.component';
import { ScreenHeaderComponent } from './screen-header.component';
import {
  BOT_DIFFICULTIES,
  BotDifficulty,
  difficultyOption,
} from '../state/bot-controller';
import { GameMode } from '../state/game.states';
import { getLevel, levelTitle, LEVELS } from '../state/levels';
import { ruleNote } from '../state/win-conditions';
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

/**
 * The screen a match starts from: who plays, how hard the computer plays,
 * and on which level - with the medallions each level holds, the locks of
 * the campaign ladder and what the chosen level's next medallion asks for.
 *
 * A dumb component - it shows what it is given and reports what the player
 * picks.
 */
@Component({
  selector: 'feat-lazy-bac-game-level-select',
  imports: [
    LevelCardComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSliderModule,
    MedallionComponent,
    ScreenHeaderComponent,
  ],
  templateUrl: './level-select.component.html',
  styleUrl: './level-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelSelectComponent {
  public readonly mode = input.required<GameMode>();
  public readonly difficulty = input.required<BotDifficulty>();
  /** The level the match will be played on. */
  public readonly levelId = input.required<string>();
  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});
  /** Why each locked level is locked, by level id. */
  public readonly locks = input<Readonly<Record<string, string>>>({});
  /** True while every level is open against the computer. */
  public readonly freePlay = input(false);
  /** Between two players: how many matches a series is the best of. */
  public readonly seriesLength = input<SeriesLength>(1);
  /** Between two players: who starts bigger. */
  public readonly headStart = input<HeadStart>(0);
  /** The names of the left and the right colony, for the head start. */
  public readonly colonyNames = input<readonly [string, string]>([
    'Left',
    'Right',
  ]);
  /** The lifetime wins of the two colonies' colours - the rivalry. */
  public readonly rivalry = input<readonly [number, number]>([0, 0]);
  /** Today's daily level, null to leave it out. */
  public readonly daily = input<DailyCard | null>(null);
  /** The most levels beaten in one endless run. */
  public readonly endlessBest = input(0);

  public readonly modeChange = output<GameMode>();
  public readonly difficultyChange = output<BotDifficulty>();
  public readonly levelChange = output<string>();
  public readonly freePlayChange = output<boolean>();
  public readonly seriesLengthChange = output<SeriesLength>();
  public readonly headStartChange = output<HeadStart>();
  public readonly start = output<void>();
  public readonly back = output<void>();
  public readonly playDaily = output<void>();
  public readonly playEndless = output<void>();

  protected readonly difficulties = BOT_DIFFICULTIES;
  protected readonly seriesLengths = SERIES_LENGTHS;

  /** The lifetime score of the two colours, "Orange 14 : 9 Blue". */
  protected readonly rivalryLine = computed(() =>
    formatScore(this.colonyNames(), this.rivalry())
  );

  /** The head starts on offer, named after the colony that gets it. */
  protected readonly headStarts = computed(() => {
    return HEAD_STARTS.map((value) => ({
      value,
      label: headStartLabel(value, this.colonyNames()),
    }));
  });

  protected readonly vsComputer = computed(() => this.mode() === 'vs-computer');

  /**
   * The ladder chapter by chapter, a card per level - each in the colours of
   * its arena.
   */
  protected readonly chapters = computed(() =>
    CHAPTERS.map((chapter) => {
      const cards = chapter.levelIds.map((id) => this.card(id));
      return {
        name: chapter.name,
        blurb: chapter.blurb,
        open: cards.filter((card) => card.lock === null).length,
        cards,
      };
    })
  );

  /** True while the ladder's locks apply - against the computer, no free play. */
  protected readonly laddered = computed(
    () => this.vsComputer() && !this.freePlay()
  );

  /**
   * The level rolled last, still offered once a ladder level is picked -
   * there is no other way back to its seed.
   */
  private readonly rolled = linkedSignal<string, string | null>({
    source: this.levelId,
    computation: (id, previous) =>
      parseGeneratedId(id) !== null ? id : (previous?.value ?? null),
  });

  protected readonly rolledCard = computed(() => {
    const id = this.rolled();
    return id === null ? null : this.card(id);
  });

  protected readonly styles = [
    { id: 'any' as const, name: 'Any' },
    ...RECIPE_IDS.map((id) => ({ id, name: RECIPES[id].label })),
  ];
  protected readonly endlessNote = endlessNote;
  protected readonly minDifficulty = MIN_DIFFICULTY;
  protected readonly maxDifficulty = MAX_DIFFICULTY;
  /**
   * The style and the difficulty the next generated level gets - those of
   * the level rolled last, until changed.
   */
  protected readonly style = linkedSignal<RecipeId | 'any'>(
    () => parseGeneratedId(this.rolled() ?? '')?.recipe ?? 'any'
  );
  protected readonly heat = linkedSignal(
    () => parseGeneratedId(this.rolled() ?? '')?.difficulty ?? 5
  );

  /** Makes a level of the chosen style and difficulty and picks it. */
  protected generate(): void {
    this.levelChange.emit(rollLevelId(this.style(), this.heat()));
  }

  /**
   * A level's card: its badge - its place on the ladder, or the style of a
   * generated one - its lock, its medallions, its arena's colours.
   */
  private card(id: string): LevelCard {
    const level = getLevel(id);
    const theme = arenaTheme(id);
    const made = parseGeneratedId(id);
    return {
      id,
      badge:
        made === null
          ? String(LEVELS.indexOf(level) + 1)
          : RECIPES[made.recipe].label,
      title: made === null ? levelTitle(level) : level.name,
      lock: this.locks()[id] ?? null,
      floor: cssTriple(theme.floor),
      edge: cssTriple(theme.border),
      medals: BOT_DIFFICULTIES.map((difficulty) => ({
        difficulty: difficulty.id,
        tier: this.medals()[id]?.[difficulty.id] ?? null,
      })),
    };
  }

  /** The chosen level, with its best medallion and what the next one needs. */
  protected readonly selected = computed(() => {
    const level = getLevel(this.levelId());
    const best = this.medals()[level.id]?.[this.difficulty()] ?? null;
    const made = parseGeneratedId(level.id);
    return {
      level,
      // Above the name: the ladder's number and name, or what was rolled -
      // and the clock of a timed level.
      kicker: [
        made === null
          ? level.name
          : `${RECIPES[made.recipe].label} · difficulty ${made.difficulty}`,
        ruleNote(level.win),
      ]
        .filter((part) => part !== null)
        .join(' · '),
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
}
