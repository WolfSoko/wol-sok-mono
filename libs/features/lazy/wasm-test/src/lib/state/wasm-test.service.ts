import { Injectable } from '@angular/core';
import { InstantiateFibWasmService } from '@wolsok/fib-wasm-api';
import { delay, filter, switchMapTo, take, tap } from 'rxjs/operators';
import { FibonacciJsCalcService } from '../fibonacci-js-calc/fibonacci-js-calc.service';
import { WasmTestQuery } from './wasm-test.query';
import { WasmTestStore } from './wasm-test.store';

@Injectable({ providedIn: 'root' })
export class WasmTestService {
  constructor(
    private readonly wasmTestStore: WasmTestStore,
    private readonly wasmTestQuery: WasmTestQuery,
    instantiateFibWasmService: InstantiateFibWasmService,
    private readonly fibonacciJsCalcService: FibonacciJsCalcService
  ) {
    instantiateFibWasmService
      .instantiateWasm()
      .then((result) => {
        this.fib = result.exports.fib;
        this.fibMem = result.exports.fibMem;
        this.wasmTestStore.setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        this.wasmTestStore.setError('Error loading WASM module!');
        this.wasmTestStore.setLoading(false);
      });

    instantiateFibWasmService.recursiveCalls$
      .pipe(
        tap((recursiveCalls) => this.wasmTestStore.update({ recursiveCalls }))
      )
      .subscribe();
  }

  startFibCalc(): void {
    this.wasmTestQuery
      .selectLoading()
      .pipe(
        filter((loading) => !loading),
        switchMapTo(this.wasmTestQuery.selectFibN()),
        take(1),
        tap(() =>
          this.wasmTestStore.update({ fibRunning: true, recursiveCalls: 0 })
        ),
        delay(20),
        tap((n) => {
          let startTime = window.performance.now();
          const wasmFib = this.fib(n);
          const fibWasmTime = window.performance.now() - startTime;
          startTime = window.performance.now();
          this.fibonacciJsCalcService.calcFibonacciRecursiveNaive(n);
          const fibJSTime = window.performance.now() - startTime;
          this.wasmTestStore.update({
            fibRunning: false,
            fibResult: { fibOfN: wasmFib, fibWasmTime, fibJSTime, n },
          });
        })
      )
      .subscribe({ error: (error) => this.handleCalculationError(error) });
  }

  startFibMemCalc(): void {
    this.wasmTestQuery
      .selectLoading()
      .pipe(
        filter((loading) => !loading),
        switchMapTo(this.wasmTestQuery.selectFibN()),
        take(1),
        tap(() =>
          this.wasmTestStore.update({ fibRunning: true, recursiveCalls: 0 })
        ),
        delay(20),
        tap((n) => {
          let startTime = window.performance.now();
          const wasmFib = this.fibMem(n);
          const fibWasmTime = window.performance.now() - startTime;

          startTime = window.performance.now();
          this.fibonacciJsCalcService.calcFibonacciMemoize(n);
          const fibJSTime = window.performance.now() - startTime;

          this.wasmTestStore.update({
            fibRunning: false,
            fibResult: {
              n,
              fibOfN: wasmFib,
              fibWasmTime,
              fibJSTime,
            },
          });
        })
      )
      .subscribe({ error: (err) => this.handleCalculationError(err) });
  }

  private fib: (n: number) => number = (noop: number) => noop;

  private fibMem: (n: number) => number = (noop: number) => noop;

  private handleCalculationError(error: unknown): void {
    console.error(error);
    this.wasmTestStore.setError('Error calculating Fibonacci number');
    this.wasmTestStore.setLoading(false);
  }
}
