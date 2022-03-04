export const imports = {
  env: {
    logRecCalls(recCalls: number) {
      console.log("Recursive calls: ", recCalls);
    },
    abort(msg: number, file: number, line: number, column: number) {
      console.error(`abort called at ${file}:${line}:${column} with msg: ${msg}`);
    },
    memory: new WebAssembly.Memory({ initial: 256 })
  }
};
