/** The GPU and driver a context renders with. */
export function rendererOf(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = gl.getParameter(
    info == null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL
  );
  return typeof name === 'string' ? name : 'unknown';
}

/**
 * The renderer this browser's WebGL2 draws with, null without WebGL2 -
 * asked of a throwaway context, which goes back to the browser at once: a
 * page may only hold a few.
 */
export function webGlRenderer(): string | null {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (gl == null) {
    return null;
  }
  try {
    return rendererOf(gl);
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/**
 * A renderer that draws on the CPU: Chromium's SwiftShader, Mesa's llvmpipe
 * and softpipe, Windows' basic render driver. Such a "GPU" computes the
 * integer passes right, so it passes the self-test, but takes hundreds of
 * milliseconds a tick at the online grid, where the CPU's ruleset takes a
 * few - and paints the arena slower than Canvas 2D does.
 */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}
