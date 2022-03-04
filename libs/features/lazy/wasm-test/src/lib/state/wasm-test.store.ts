import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface FibResult {
  n: number;
  fibOfN: number;
  fibWasmTime: number;
  fibJSTime: number;
}

export interface WasmTestState {
  fibRunning: boolean;
  fibOptions: { fibN: number };
  fibResult: FibResult | null;
  recursiveCalls: number;
}

export function createInitialState(): WasmTestState {
  return {
    fibRunning: false,
    fibResult: null,
    fibOptions: { fibN: 40 },
    recursiveCalls: 0,
  };
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'wasm-test' })
export class WasmTestStore extends Store<WasmTestState> {
  constructor() {
    super(createInitialState());
  }
}
