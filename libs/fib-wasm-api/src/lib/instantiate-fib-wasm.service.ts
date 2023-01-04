import { Injectable } from '@angular/core';
import { instantiateStreaming } from '@assemblyscript/loader';
import { Subject } from 'rxjs';
import { FibWasmImports } from './fib-wasm-imports';
import { FibWasmResultObject } from './fib-wasm-result-object';

@Injectable({
  providedIn: 'root',
})
export class InstantiateFibWasmService {
  private recursiveCallsAction = new Subject<number>();
  public recursiveCalls$ = this.recursiveCallsAction.asObservable();

  private imports: FibWasmImports = {
    index: {
      logRecCalls: (recCalls: number) => {
        console.log('Recursive calls: ', recCalls);
        this.recursiveCallsAction.next(recCalls);
      },
    },
    env: {
      abort(msg: number, file: number, line: number, column: number) {
        console.error(`abort called at ${file}:${line}:${column} with msg: ${msg}`);
      },
      memory: new WebAssembly.Memory({ initial: 256 }),
    },
  };

  async instantiateWasm(): Promise<FibWasmResultObject> {
    return instantiateStreaming<{
      fib(n: number): number;
      fibMem(n: number): number;
    }>(fetch('fib-wasm/optimized.wasm'), this.imports);
  }
}
