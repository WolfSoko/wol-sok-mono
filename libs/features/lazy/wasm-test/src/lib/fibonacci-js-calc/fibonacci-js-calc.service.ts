import { Injectable } from '@angular/core';
import { Memoized } from '@wolsok/utils-decorators';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FibonacciJsCalcService {
  private static resetMemoizeAction = new Subject<void>();

  calcFibonacciMemoize(n: number) {
    this.resetMemoize();
    return this.calcFibonacciMemoizeInternal(n);
  }

  resetMemoize(): void {
    FibonacciJsCalcService.resetMemoizeAction.next();
  }

  calcFibonacciRecursiveNaive(n: number): number {
    if (n < 2) {
      return n;
    }
    return (
      this.calcFibonacciRecursiveNaive(n - 1) +
      this.calcFibonacciRecursiveNaive(n - 2)
    );
  }

  @Memoized(FibonacciJsCalcService.resetMemoizeAction.asObservable())
  private calcFibonacciMemoizeInternal(n: number): number {
    if (n < 2) {
      return n;
    }
    return (
      this.calcFibonacciMemoizeInternal(n - 1) +
      this.calcFibonacciMemoizeInternal(n - 2)
    );
  }
}
