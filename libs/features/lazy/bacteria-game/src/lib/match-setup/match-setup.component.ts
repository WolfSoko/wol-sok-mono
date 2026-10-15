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
import { BOT_DIFFICULTIES, BotDifficulty } from '../state/bot-controller';
import { GameMode } from '../state/game.states';
import { Level, LEVELS } from '../state/levels';

/**
 * The controls that set up the next match: opponent, difficulty and level.
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
  ],
  templateUrl: './match-setup.component.html',
  styleUrl: './match-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchSetupComponent {
  public readonly mode = input.required<GameMode>();
  public readonly difficulty = input.required<BotDifficulty>();
  public readonly level = input.required<Level>();
  /** True while a match is on and the setup must not change. */
  public readonly disabled = input(false);

  public readonly modeChange = output<GameMode>();
  public readonly difficultyChange = output<BotDifficulty>();
  public readonly levelChange = output<string>();

  protected readonly levels = LEVELS;
  protected readonly difficulties = BOT_DIFFICULTIES;

  /** The briefing of the selected difficulty. */
  protected readonly difficultyDescription = computed(
    () =>
      BOT_DIFFICULTIES.find((option) => option.id === this.difficulty())
        ?.description ?? ''
  );
}
