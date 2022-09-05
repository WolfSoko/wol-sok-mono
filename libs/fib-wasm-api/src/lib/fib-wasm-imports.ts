import { Imports } from "@assemblyscript/loader";

export interface FibWasmImports extends Imports {
  index: { logRecCalls(recCalls: number): void };
}
