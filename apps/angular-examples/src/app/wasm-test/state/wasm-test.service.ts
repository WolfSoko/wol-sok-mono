import { Injectable } from "@angular/core";
import { imports } from "@wolsok/fib-wasm";
import { ASUtil, instantiateStreaming, ResultObject } from "assemblyscript/lib/loader";
import { delay, filter, switchMapTo, take, tap } from "rxjs/operators";
import { WasmTestQuery } from "./wasm-test.query";
import { WasmTestStore } from "./wasm-test.store";

function fibJS(n: number): number {
  if (n < 2) {
    return n;
  }
  return fibJS(n - 1) + fibJS(n - 2);
}

const memoize = Array<number>(50);

function fibMemJS(nth: number): number {
  memoize.fill(-1, 0, 50);
  return fibMemRec(nth);
}

function fibMemRec(n: number): number {
  if (n < 2) {
    return n;
  }
  if (memoize[n] > -1) {
    return memoize[n];
  }

  const result = fibMemRec(n - 1) + fibMemRec(n - 2);
  memoize[n] = result;
  return result;
}


@Injectable({ providedIn: "root" })
export class WasmTestService {

  constructor(private wasmTestStore: WasmTestStore,
              private wasmTestQuery: WasmTestQuery) {
    WasmTestService.instantiateWasm()
      .then(result => {
        this.fib = result.exports.fib;
        this.fibMem = result.exports.fibMem;
        this.wasmTestStore.setLoading(false);
      })
      .catch(e => {
        console.error(e);
        this.wasmTestStore.setError("Error loading WASM module!");
        this.wasmTestStore.setLoading(false);
      });
  }

  private static async instantiateWasm(): Promise<ResultObject & { exports: ASUtil & { fib(n: number): number; fibMem(n: number): number } }> {
    return instantiateStreaming<{ fib(n: number): number, fibMem(n: number): number }>(fetch("fib-wasm/optimized.wasm"), imports);
  }

  startFibCalc(): void {
    this.wasmTestQuery.selectLoading().pipe(
      filter(loading => !loading),
      switchMapTo(this.wasmTestQuery.selectFibN()),
      take(1),
      tap(() => this.wasmTestStore.update({ fibRunning: true })),
      delay(20),
      tap(n => {
        let startTime = window.performance.now();
        const wasmFib = this.fib(n);
        const fibWasmTime = window.performance.now() - startTime;

        startTime = window.performance.now();
        fibJS(n);
        const fibJSTime = window.performance.now() - startTime;

        this.wasmTestStore.update({
          fibRunning: false, fibResult: { fibOfN: wasmFib, fibWasmTime, fibJSTime, n }
        });
      })
    ).subscribe({ error: (error) => this.handleCalculationError(error) });
  }

  startFibMemCalc(): void {
    this.wasmTestQuery.selectLoading().pipe(
      filter(loading => !loading),
      switchMapTo(this.wasmTestQuery.selectFibN()),
      take(1),
      tap(() => this.wasmTestStore.update({ fibRunning: true })),
      delay(20),
      tap(n => {
        let startTime = window.performance.now();
        const wasmFib = this.fibMem(n);
        const fibWasmTime = window.performance.now() - startTime;

        startTime = window.performance.now();
        fibMemJS(n);
        const fibJSTime = window.performance.now() - startTime;

        this.wasmTestStore.update({
          fibRunning: false,
          fibResult: {
            n,
            fibOfN: wasmFib,
            fibWasmTime,
            fibJSTime
          }
        });
      })
    ).subscribe({ error: err => this.handleCalculationError(err) });
  }

  private fib: (n: number) => number = (noop: number) => noop;

  private fibMem: (n: number) => number = (noop: number) => noop;

  private handleCalculationError(error: unknown): void {
    console.error(error);
    this.wasmTestStore.setError("Error calculating Fibonacci number");
    this.wasmTestStore.setLoading(false);
  }
}


