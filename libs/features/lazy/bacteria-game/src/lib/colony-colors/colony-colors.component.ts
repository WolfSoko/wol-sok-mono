import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
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
 * other seat's colour is the game's to resolve - it swaps the two. Colours
 * still to earn show a lock and what opens them.
 */
@Component({
  selector: 'feat-lazy-bac-game-colony-colors',
  imports: [MatButtonToggleModule, MatIconModule, MatTooltipModule],
  templateUrl: './colony-colors.component.html',
  styleUrl: './colony-colors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColonyColorsComponent {
  public readonly mode = input.required<GameMode>();
  /** The colour ids of the left and the right colony. */
  public readonly colors = input.required<readonly [string, string]>();
  public readonly disabled = input(false);
  /**
   * Why each colour still to earn is locked, by colour id. A locked colour
   * cannot be picked - but one a seat already has stays.
   */
  public readonly locks = input<Readonly<Record<string, string>>>({});

  public readonly colorChange = output<ColorChange>();

  protected readonly palette = COLONY_COLORS;

  /** Who sits in each seat, for the label of its colour picker. */
  protected readonly seats = computed(() =>
    this.mode() === 'vs-computer'
      ? (['You', 'Computer'] as const)
      : (['Left player', 'Right player'] as const)
  );

  /** The colours still to earn, with what opens each - written out, for touch and keyboard. */
  protected readonly lockedList = computed(() =>
    this.palette
      .filter(({ id }) => id in this.locks())
      .map(({ id, name, rgb }) => ({
        id,
        name,
        lock: this.locks()[id],
        css: `rgb(${rgb.join(',')})`,
      }))
  );

  /**
   * True where a seat may not pick a colour: one still to earn that the
   * seat does not have, or the other seat's colour where the swap would
   * hand that seat one still to earn.
   */
  protected blocked(seat: number, colorId: string): boolean {
    const own = this.colors()[seat];
    const other = this.colors()[1 - seat];
    const locks = this.locks();
    return (
      (colorId in locks && colorId !== own) ||
      (colorId === other && own in locks)
    );
  }

  protected pick(seat: number, colorId: string): void {
    this.colorChange.emit({ seat: seat === 0 ? 0 : 1, colorId });
  }
}
