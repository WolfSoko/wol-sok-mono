import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { GameStateQuery } from '../state/game-state.query';
import { Level, LEVELS, nextLevel } from '../state/levels';
import { Player } from '../state/player.model';

/** What the player picked when the match was over. */
export type MatchEndAction = 'again' | 'next';

@Component({
  imports: [MatToolbarModule, MatButtonModule, MatDialogModule],
  templateUrl: './winner.component.html',
  styleUrls: ['./winner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinnerComponent {
  private state = inject(GameStateQuery);

  /** Null when both colonies wiped each other out in the same step. */
  public winner: Signal<Player | null | undefined> = toSignal(
    this.state.selectWinnerId()
  );

  /** The level that was just played. */
  public level: Signal<Level> = toSignal(this.state.selectLevel(), {
    initialValue: LEVELS[0],
  });

  /** The level that comes next, null after the last one. */
  public upcoming: Signal<Level | null> = computed(() =>
    nextLevel(this.level().id)
  );
}
