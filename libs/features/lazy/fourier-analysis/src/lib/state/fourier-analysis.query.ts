import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { InputWave } from '../model/input-wave.model';
import {
  FourierAnalysisState,
  FourierAnalysisStore,
} from './fourier-analysis.store';
import { InputWaveRepo } from './input-wave-repo';

@Injectable({ providedIn: 'root' })
export class FourierAnalysisQuery extends Query<FourierAnalysisState> {
  readonly selectActiveWave: Observable<InputWave | undefined>;

  constructor(
    protected override store: FourierAnalysisStore,
    private waveQuery: InputWaveRepo
  ) {
    super(store);
    this.selectActiveWave = this.waveQuery.activeWave$;
  }
}
