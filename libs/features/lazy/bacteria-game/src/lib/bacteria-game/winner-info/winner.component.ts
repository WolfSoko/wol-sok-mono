import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Observable } from 'rxjs';
import { GameStateQuery } from '../state/game-state.query';
import { Player } from '../state/player.model';

@Component({
  standalone: true,
  imports: [CommonModule, MatToolbarModule],
  templateUrl: './winner.component.html',
  styleUrls: ['./winner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinnerComponent {
  winner$: Observable<Player | null>;

  constructor(state: GameStateQuery) {
    this.winner$ = state.selectWinnerId();
  }
}
