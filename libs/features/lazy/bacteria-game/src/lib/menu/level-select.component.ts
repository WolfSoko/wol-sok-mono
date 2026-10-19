import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
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
  HEAD_STARTS,
  HeadStart,
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
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
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

  public readonly modeChange = output<GameMode>();
  public readonly difficultyChange = output<BotDifficulty>();
  public readonly levelChange = output<string>();
  public readonly freePlayChange = output<boolean>();
  public readonly seriesLengthChange = output<SeriesLength>();
  public readonly headStartChange = output<HeadStart>();
  public readonly start = output<void>();
  public readonly back = output<void>();

  protected readonly difficulties = BOT_DIFFICULTIES;
  protected readonly seriesLengths = SERIES_LENGTHS;

  /** The head starts on offer, named after the colony that gets it. */
  protected readonly headStarts = computed(() => {
    const [left, right] = this.colonyNames();
    return HEAD_STARTS.map((value) => ({
      value,
      label:
        value === 0
          ? 'Even'
          : `${value < 0 ? left : right} ${'+'.repeat(Math.abs(value))}`,
    }));
  });

  protected readonly vsComputer = computed(() => this.mode() === 'vs-computer');

  /** A card per level, in the order of the ladder. */
  protected readonly cards = computed(() =>
    LEVELS.map((level, index) => ({
      id: level.id,
      number: index + 1,
      title: levelTitle(level),
      lock: this.locks()[level.id] ?? null,
      medals: BOT_DIFFICULTIES.map((difficulty) => ({
        difficulty: difficulty.id,
        tier: this.medals()[level.id]?.[difficulty.id] ?? null,
      })),
    }))
  );

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
