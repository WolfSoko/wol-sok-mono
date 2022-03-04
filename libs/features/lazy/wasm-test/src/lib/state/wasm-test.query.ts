import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { FibResult, WasmTestState, WasmTestStore } from './wasm-test.store';

@Injectable({ providedIn: 'root' })
export class WasmTestQuery extends Query<WasmTestState> {
  constructor(protected override store: WasmTestStore) {
    super(store);
  }

  selectFibRunning() {
    return this.select('fibRunning');
  }

  selectFibResult(): Observable<FibResult | null> {
    return this.select('fibResult');
  }

  selectFibN() {
    return this.select((state) => state.fibOptions.fibN);
  }

  selectRecursiveCalls() {
    return this.select('recursiveCalls');
  }
}
