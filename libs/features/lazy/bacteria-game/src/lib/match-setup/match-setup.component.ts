import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  ColonyColorsComponent,
  ColorChange,
} from '../colony-colors/colony-colors.component';
import { MedallionComponent } from '../medallion/medallion.component';
import {
  BOT_DIFFICULTIES,
  BotDifficulty,
  difficultyOption,
} from '../state/bot-controller';
import { GameMode } from '../state/game.states';
import { Level, LEVELS } from '../state/levels';
import { MedalTier } from '../state/medallions';

/**
 * The controls that set up the next match: opponent, difficulty, colours
 * and level.
 *
 * A dumb component - it only shows what it is given and reports what the
 * player picked. Whether a pick may take effect is the game's decision.
 */
@Component({
  selector: 'feat-lazy-bac-game-match-setup',
  imports: [
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MedallionComponent,
    ColonyColorsComponent,
  ],
  templateUrl: './match-setup.component.html',
  styleUrl: './match-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchSetupComponent {
  public readonly mode = input.required<GameMode>();
  public readonly difficulty = input.required<BotDifficulty>();
  public readonly level = input.required<Level>();
  /** The colour ids of the left and the right colony. */
  public readonly colors = input.required<readonly [string, string]>();
  /**
   * The best medallion of each level at the selected difficulty, by level
   * id - shown in the level list against the computer.
   */
  public readonly medals = input<Readonly<Record<string, MedalTier | null>>>(
    {}
  );
  /**
   * Why a level is still locked on the campaign ladder, by level id - a
   * level missing or null is open.
   */
  public readonly locked = input<Readonly<Record<string, string | null>>>({});
  /** True while every level is open against the computer. */
  public readonly freePlay = input(false);
  /** True while a match is on and the setup must not change. */
  public readonly disabled = input(false);

  public readonly modeChange = output<GameMode>();
  public readonly difficultyChange = output<BotDifficulty>();
  public readonly levelChange = output<string>();
  public readonly freePlayChange = output<boolean>();
  public readonly colorChange = output<ColorChange>();

  protected readonly levels = LEVELS;
  protected readonly difficulties = BOT_DIFFICULTIES;

  /** The briefing of the selected difficulty. */
  protected readonly difficultyDescription = computed(
    () => difficultyOption(this.difficulty())?.description ?? ''
  );
}
