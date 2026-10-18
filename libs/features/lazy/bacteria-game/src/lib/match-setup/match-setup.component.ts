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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MedallionComponent } from '../medallion/medallion.component';
import { BOT_DIFFICULTIES, BotDifficulty } from '../state/bot-controller';
import { COLONY_COLORS } from '../state/colony-colors';
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
    MatTooltipModule,
    MedallionComponent,
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
  /** True while a match is on and the setup must not change. */
  public readonly disabled = input(false);

  public readonly modeChange = output<GameMode>();
  public readonly difficultyChange = output<BotDifficulty>();
  public readonly levelChange = output<string>();
  public readonly colorChange = output<ColorChange>();

  protected readonly levels = LEVELS;
  protected readonly difficulties = BOT_DIFFICULTIES;
  protected readonly palette = COLONY_COLORS;

  /** Who sits in each seat, for the label of its colour picker. */
  protected readonly seats = computed(() =>
    this.mode() === 'vs-computer'
      ? (['You', 'Computer'] as const)
      : (['Left player', 'Right player'] as const)
  );

  protected pickColor(seat: number, colorId: string): void {
    this.colorChange.emit({ seat: seat === 0 ? 0 : 1, colorId });
  }

  /** The briefing of the selected difficulty. */
  protected readonly difficultyDescription = computed(
    () =>
      BOT_DIFFICULTIES.find((option) => option.id === this.difficulty())
        ?.description ?? ''
  );
}

/** A seat - 0 is the left one, 1 the right one - picked another colour. */
export interface ColorChange {
  seat: 0 | 1;
  colorId: string;
}
