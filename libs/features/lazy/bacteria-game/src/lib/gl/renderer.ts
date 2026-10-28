/** The GPU and driver a context renders with. */
export function rendererOf(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = gl.getParameter(
    info == null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL
  );
  return typeof name === 'string' ? name : 'unknown';
}
