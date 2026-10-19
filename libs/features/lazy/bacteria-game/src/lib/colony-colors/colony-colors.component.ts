import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { COLONY_COLORS } from '../state/colony-colors';
import { GameMode } from '../state/game.states';

/** A seat - 0 is the left one, 1 the right one - picked another colour. */
export interface ColorChange {
  seat: 0 | 1;
  colorId: string;
}

/**
 * A row of colour swatches per seat, named after who sits there. Picking the
 * other seat's colour is the game's to resolve - it swaps the two.
 */
@Component({
  selector: 'feat-lazy-bac-game-colony-colors',
  imports: [MatButtonToggleModule, MatTooltipModule],
  templateUrl: './colony-colors.component.html',
  styleUrl: './colony-colors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColonyColorsComponent {
  public readonly mode = input.required<GameMode>();
  /** The colour ids of the left and the right colony. */
  public readonly colors = input.required<readonly [string, string]>();
  public readonly disabled = input(false);

  public readonly colorChange = output<ColorChange>();

  protected readonly palette = COLONY_COLORS;

  /** Who sits in each seat, for the label of its colour picker. */
  protected readonly seats = computed(() =>
    this.mode() === 'vs-computer'
      ? (['You', 'Computer'] as const)
      : (['Left player', 'Right player'] as const)
  );

  protected pick(seat: number, colorId: string): void {
    this.colorChange.emit({ seat: seat === 0 ? 0 : 1, colorId });
  }
}
