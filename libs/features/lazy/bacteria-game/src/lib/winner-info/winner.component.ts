import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatToolbarModule } from '@angular/material/toolbar';
import { GameStateQuery } from '../state/game-state.query';
import { Player } from '../state/player.model';

@Component({
  imports: [MatToolbarModule],
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
}
