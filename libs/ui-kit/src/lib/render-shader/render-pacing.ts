/**
 * How a shader canvas spends its frames: the size of its drawing buffer, the
 * frames it skips and the renderers it does not animate on.
 */

/** The drawing buffer of a canvas drawn at `scale` of its CSS size. */
export function bufferSize(cssSize: number, scale: number): number {
  const clamped = Math.min(Math.max(scale, 0.1), 1);
  return Math.max(1, Math.round(cssSize * clamped));
}

/**
 * Whether a frame at `now` is drawn, the last drawn at `last` (null for
 * none), with at most `maxFps` frames a second - 0 for every frame. A frame
 * a few ms early still counts, so 20 fps on a 60 Hz display draws every
 * third frame rather than every fourth.
 */
export function shouldDraw(
  now: number,
  last: number | null,
  maxFps: number
): boolean {
  if (maxFps <= 0 || last === null) {
    return true;
  }
  return now - last >= 1000 / maxFps - 2;
}

/**
 * Whether a WebGL renderer's name is a software one, where the CPU draws
 * every pixel on the page's main thread: SwiftShader, llvmpipe, softpipe.
 */
export function isSoftwareRenderer(name: string | null): boolean {
  return name !== null && /swiftshader|llvmpipe|softpipe|software/i.test(name);
}

/** The unmasked renderer name of a WebGL context, null where it is hidden. */
export function rendererName(gl: WebGL2RenderingContext): string | null {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return typeof name === 'string' ? name : null;
}
