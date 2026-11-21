/**
 * A WebGL2 context for specs that only care which calls were made: every
 * method is a `jest.fn`, created on first use and recorded in `calls`. A
 * constant (an upper-case name) is a number of its own. Objects come back
 * as fresh `{}`, and checks pass: programs link, shaders compile,
 * framebuffers are complete. `getError` gives the codes queued with
 * `failNext`, then `NO_ERROR`.
 */
export interface FakeGl {
  gl: WebGL2RenderingContext;
  /** The calls made so far, by method name, with their arguments. */
  calls: Map<string, unknown[][]>;
  /** How often a method was called with these arguments. */
  callsOf(name: string, ...args: unknown[]): number;
  /** Queues an error for `getError`, after the ones already queued. */
  failNext(code: number): void;
  /** Queues an error for `getError` once that method is called next. */
  failOn(method: string, code: number): void;
}

/** The value a constant of the fake context has. */
export function glConstant(name: string): number {
  let hash = 7;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  // Clear of NO_ERROR (0) and of small numbers a spec might use.
  return 0x10000 + (hash % 0xffff);
}

const NO_ERROR = 0;

export function fakeGl(): FakeGl {
  const calls = new Map<string, unknown[][]>();
  const errors: number[] = [];
  const methods = new Map<string, jest.Mock>();
  const failing = new Map<string, number>();
  const results: Record<string, (...args: unknown[]) => unknown> = {
    getProgramParameter: () => true,
    getShaderParameter: () => true,
    checkFramebufferStatus: () => glConstant('FRAMEBUFFER_COMPLETE'),
    getUniformLocation: () => ({}),
    getExtension: () => null,
    getParameter: () => 'fake renderer',
    isVertexArray: () => true,
    isTexture: () => true,
    getError: () => errors.shift() ?? NO_ERROR,
  };
  const target: Record<string | symbol, unknown> = { NO_ERROR };
  const gl = new Proxy(target, {
    get(_, name) {
      if (typeof name !== 'string') {
        return undefined;
      }
      if (name in target) {
        return target[name];
      }
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
        return glConstant(name);
      }
      let method = methods.get(name);
      if (method == null) {
        const result =
          results[name] ?? (() => (name.startsWith('create') ? {} : undefined));
        method = jest.fn((...args: unknown[]) => {
          const made = calls.get(name) ?? [];
          made.push(args);
          calls.set(name, made);
          const failure = failing.get(name);
          if (failure != null) {
            failing.delete(name);
            errors.push(failure);
          }
          return result(...args);
        });
        methods.set(name, method);
      }
      return method;
    },
  }) as unknown as WebGL2RenderingContext;
  return {
    gl,
    calls,
    callsOf: (name, ...args) =>
      (calls.get(name) ?? []).filter((made) =>
        args.every((arg, index) => Object.is(made[index], arg))
      ).length,
    failNext: (code) => errors.push(code),
    failOn: (method, code) => failing.set(method, code),
  };
}
