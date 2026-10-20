import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { arenaTheme, cssTriple } from '../arena/arena-theme';
import { CHAPTERS } from '../state/chapters';
import { randomSeed } from '../state/geometry';
import {
  generatedLevelId,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  parseGeneratedId,
} from '../state/level-generator/generate-level';
import { RECIPE_IDS, RecipeId } from '../state/level-generator/recipes';
import { DailyCard } from './main-menu.component';
import { MedallionComponent } from '../medallion/medallion.component';
import { ScreenHeaderComponent } from './screen-header.component';
import {
  BOT_DIFFICULTIES,
  BotDifficulty,
  difficultyOption,
} from '../state/bot-controller';
import { GameMode } from '../state/game.states';
import { getLevel, levelTitle, LEVELS } from '../state/levels';
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
    NgTemplateOutlet,
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

  /** The generated level chosen, null while it is a level of the ladder. */
  protected readonly generated = computed(() => {
    const made = parseGeneratedId(this.levelId());
    return made === null
      ? null
      : {
          ...this.card(this.levelId()),
          title: getLevel(this.levelId()).name,
          style: STYLE_NAMES[made.recipe],
          difficulty: made.difficulty,
        };
  });

  protected readonly styles = [
    { id: 'any' as const, name: 'Any' },
    ...RECIPE_IDS.map((id) => ({ id, name: STYLE_NAMES[id] })),
  ];
  protected readonly minDifficulty = MIN_DIFFICULTY;
  protected readonly maxDifficulty = MAX_DIFFICULTY;
  /** The style and the difficulty the next generated level gets. */
  protected readonly style = signal<RecipeId | 'any'>('any');
  protected readonly heat = signal(5);

  /** Makes a level of the chosen style and difficulty and picks it. */
  protected generate(): void {
    const seed = randomSeed();
    const style = this.style();
    this.levelChange.emit(
      generatedLevelId({
        recipe: style === 'any' ? RECIPE_IDS[seed % RECIPE_IDS.length] : style,
        seed,
        difficulty: this.heat(),
      })
    );
  }

  /** A level's card: its place on the ladder, its lock, its medallions. */
  private card(id: string) {
    const level = getLevel(id);
    const theme = arenaTheme(id);
    return {
      id,
      number: LEVELS.indexOf(level) + 1,
      title: levelTitle(level),
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
    return {
      level,
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

/** The generator's styles as the level choice names them. */
const STYLE_NAMES: Record<RecipeId, string> = {
  field: 'Field',
  corridor: 'Corridors',
  fortress: 'Fortress',
  cave: 'Cave',
};
