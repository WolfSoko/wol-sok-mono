import {ChangeDetectionStrategy, Component} from "@angular/core";
import {Observable} from "rxjs";
import {GameStateQuery} from "../state/game-state.query";
import {Player} from "../state/player.model";

@Component({
  selector: 'app-winner',
  templateUrl: './winner.component.html',
  styleUrls: ['./winner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WinnerComponent {
  winner$: Observable<Player | null>;

  constructor(state: GameStateQuery) {
    this.winner$ = state.selectWinnerId();
  }
}
