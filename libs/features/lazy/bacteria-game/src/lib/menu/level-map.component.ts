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
import { MatSliderModule } from '@angular/material/slider';
import {
  chapterKeys,
  english,
  GameText,
  ladderLockText,
  levelTitleText,
  ONLINE_LOCK_TEXT,
  recipeKeys,
  renderGameText,
} from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { CHAPTERS } from '../state/chapters';
import {
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  parseGeneratedId,
  rollLevelId,
} from '../state/level-generator/generate-level';
import { RECIPE_IDS, RecipeId } from '../state/level-generator/recipes';
import { getLevel, LEVELS, levelSize } from '../state/levels';
import { Progress } from '../state/progress';
import { LevelCard, LevelCardComponent } from './level-card.component';
import { levelColors } from './menu-cards';

/**
 * The levels to pick from: the ladder chapter by chapter, a card per level
 * in the colours of its arena with its medallions or its lock - and, where
 * the mode allows, the generator for a level of a style and a difficulty.
 *
 * A dumb component - it shows what it is given and reports the level picked.
 */
@Component({
  selector: 'feat-lazy-bac-game-level-map',
  imports: [
    LevelCardComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSliderModule,
    TranslatePipe,
  ],
  templateUrl: './level-map.component.html',
  styleUrl: './level-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelMapComponent {
  private readonly i18n = inject(I18nService);

  /** The level picked so far. */
  public readonly levelId = input.required<string>();
  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});
  /** Why each locked level is locked, by level id - none to open them all. */
  public readonly locks = input<Readonly<Record<string, string>>>({});
  /** True to count the open levels per chapter - on the ladder. */
  public readonly laddered = input(false);
  /** False where no medallion is earned - between two players. */
  public readonly showMedals = input(true);
  /** True to offer generated levels beside the ladder. */
  public readonly generator = input(false);

  public readonly pick = output<string>();

  /** The ladder chapter by chapter, a card per level. */
  protected readonly chapters = computed(() =>
    CHAPTERS.map((chapter) => {
      const cards = chapter.levelIds.map((id) => this.card(id));
      return {
        id: chapter.id,
        ...chapterKeys(chapter.id),
        open: cards.filter((card) => card.lock === null).length,
        cards,
      };
    })
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
    {
      id: 'any' as const,
      name: 'newGame.levelMap.generated.anyStyle' as const,
    },
    ...RECIPE_IDS.map((id) => ({ id, name: recipeKeys(id).label })),
  ];
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
    this.pick.emit(rollLevelId(this.style(), this.heat()));
  }

  /**
   * A level's card: its badge - its place on the ladder, or the style of a
   * generated one - its lock, its medallions, its arena's colours and the
   * size of its map, whose picture the card draws. Its
   * texts are in the active language: the computeds that call it follow a
   * switch.
   */
  private card(id: string): LevelCard {
    const level = getLevel(id);
    const made = parseGeneratedId(id);
    const lock = this.locks()[id];
    return {
      id,
      badge:
        made === null
          ? String(LEVELS.indexOf(level) + 1)
          : this.i18n.t(recipeKeys(made.recipe).label),
      title: this.text(levelTitleText(level)),
      lock: lock === undefined ? null : this.text(lockText(id, lock)),
      ...levelColors(id),
      size: levelSize(level),
      medals: BOT_DIFFICULTIES.map((difficulty) => ({
        difficulty: difficulty.id,
        tier: this.medals()[id]?.[difficulty.id] ?? null,
      })),
    };
  }

  private text(text: GameText): string {
    return renderGameText(text, (key, params) => this.i18n.t(key, params));
  }
}

const ONLINE_LOCK = english(ONLINE_LOCK_TEXT);

/**
 * A lock as a text to translate. The locks come in English, as the state
 * keeps them: a level too big to play online, or else the ladder's.
 */
function lockText(id: string, lock: string): GameText {
  return lock === ONLINE_LOCK ? ONLINE_LOCK_TEXT : ladderLockText(id);
}
