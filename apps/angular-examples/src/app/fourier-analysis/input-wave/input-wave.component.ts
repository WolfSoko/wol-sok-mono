import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {Observable} from "rxjs";
import {InputWave} from "../state/input-wave.model";
import {InputWaveQuery} from "../state/input-wave.query";
import {InputWaveService} from "../state/input-wave.service";

@Component({
  selector: 'app-input-wave',
  templateUrl: './input-wave.component.html',
  styleUrls: ['./input-wave.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InputWaveComponent {
  @Input() width = 0;
  @Input() height = 0;
  activeWave$: Observable<InputWave | undefined>;

  constructor(
    private waveQuery: InputWaveQuery,
    private inputWaveService: InputWaveService
  ) {
    this.activeWave$ = waveQuery.selectActive();
  }

  listenToWaveAudio() {
    this.inputWaveService.listenToWave();
  }
}
