import { Imports } from 'assemblyscript/lib/loader';

export interface FibWasmImports extends Imports {
  index: { logRecCalls(recCalls: number): void };
}
