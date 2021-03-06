import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {Observable} from 'rxjs';
import {InputWave} from '../state/input-wave.model';
import {InputWaveQuery} from '../state/input-wave.query';

@Component({
  selector: 'lazy-feat-fanal-circle-analysis',
  templateUrl: './circle-analysis.component.html',
  styleUrls: ['./circle-analysis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleAnalysisComponent {
  @Input() width!: number;
  @Input() height!: number;
  activeWave$: Observable<InputWave | undefined>;

  constructor(private waveQuery: InputWaveQuery) {
    this.activeWave$ = waveQuery.selectActive();
  }
}
