import { ASUtil, ResultObject } from '@assemblyscript/loader';

export type FibWasmResultObject = ResultObject & {
  exports: ASUtil & { fib(n: number): number; fibMem(n: number): number };
};
