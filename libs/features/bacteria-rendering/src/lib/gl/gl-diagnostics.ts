/** How often an error showed after a pass. */
export interface GlErrorCount {
  pass: string;
  /** The error's GL name, `INVALID_OPERATION`, or its number. */
  error: string;
  count: number;
}

const ERROR_NAMES = [
  'INVALID_ENUM',
  'INVALID_VALUE',
  'INVALID_OPERATION',
  'INVALID_FRAMEBUFFER_OPERATION',
  'OUT_OF_MEMORY',
  'CONTEXT_LOST_WEBGL',
] as const;

/**
 * Errors read per check at most: a lost context answers every call with
 * one, and the check must not spin on it.
 */
const MAX_ERRORS_PER_CHECK = 8;

/**
 * The GL errors of a context, counted by the pass they showed after - for
 * the `?gldebug` diagnostic. Each check asks the GPU to catch up with what
 * was queued, which stalls it, so nothing checks unless asked to.
 */
export class GlDiagnostics {
  private readonly counts = new Map<string, GlErrorCount>();

  public constructor(private readonly gl: WebGL2RenderingContext) {}

  /** Takes the errors raised since the last check, as the pass's. */
  public check(pass: string): void {
    const gl = this.gl;
    for (let read = 0; read < MAX_ERRORS_PER_CHECK; read++) {
      const code = gl.getError();
      if (code === gl.NO_ERROR) {
        return;
      }
      const error = this.nameOf(code);
      const key = `${pass}:${error}`;
      const count = this.counts.get(key);
      if (count == null) {
        this.counts.set(key, { pass, error, count: 1 });
      } else {
        count.count++;
      }
    }
  }

  /** Every pass and error seen so far, in the order they first showed. */
  public errors(): GlErrorCount[] {
    return [...this.counts.values()].map((count) => ({ ...count }));
  }

  private nameOf(code: number): string {
    const gl = this.gl as unknown as Record<string, unknown>;
    return (
      ERROR_NAMES.find((name) => gl[name] === code) ?? `0x${code.toString(16)}`
    );
  }
}

const DIAGNOSED = new WeakMap<WebGL2RenderingContext, GlDiagnostics>();

/**
 * Turns the diagnostic on for a context, for everything drawing in it - the
 * painter and the GPU simulation - and hands back its diagnostics.
 */
export function diagnose(gl: WebGL2RenderingContext): GlDiagnostics {
  let diagnostics = DIAGNOSED.get(gl);
  if (diagnostics == null) {
    diagnostics = new GlDiagnostics(gl);
    DIAGNOSED.set(gl, diagnostics);
  }
  return diagnostics;
}

/**
 * Turns the diagnostic off for a context: nothing checks for errors in it
 * any more, and a later `diagnose` counts from nothing.
 */
export function undiagnose(gl: WebGL2RenderingContext): void {
  DIAGNOSED.delete(gl);
}

/** Checks for errors after a pass - only where the context is diagnosed. */
export function checkGl(gl: WebGL2RenderingContext, pass: string): void {
  DIAGNOSED.get(gl)?.check(pass);
}
