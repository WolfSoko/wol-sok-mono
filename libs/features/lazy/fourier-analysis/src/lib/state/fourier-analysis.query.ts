import {Injectable} from '@angular/core';
import {Query} from '@datorama/akita';
import {Observable} from 'rxjs';
import {FourierAnalysisState, FourierAnalysisStore} from './fourier-analysis.store';
import {InputWave} from './input-wave.model';
import {InputWaveQuery} from './input-wave.query';

@Injectable({ providedIn: 'root' })
export class FourierAnalysisQuery extends Query<FourierAnalysisState> {
  readonly selectActiveWave: Observable<InputWave | undefined>;

  constructor(
    protected override store: FourierAnalysisStore,
    private waveQuery: InputWaveQuery
  ) {
    super(store);
    this.selectActiveWave = this.waveQuery.selectActive();
  }
}
