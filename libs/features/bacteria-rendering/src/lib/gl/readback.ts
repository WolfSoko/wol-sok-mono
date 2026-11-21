/**
 * Reading what the GPU drew back to the CPU, as RGBA bytes - for the GL
 * diagnostic. Each read waits for the GPU, so nothing calls it in a frame.
 */

/** The RGBA bytes of a framebuffer, its bottom row first, as GL keeps them. */
export function readFramebuffer(
  gl: WebGL2RenderingContext,
  framebuffer: WebGLFramebuffer,
  width: number,
  height: number
): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return pixels;
}

/** The RGBA bytes of a texture without a framebuffer, through a passing one. */
export function readTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  width: number,
  height: number
): Uint8Array {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  const pixels = readFramebuffer(gl, framebuffer, width, height);
  gl.deleteFramebuffer(framebuffer);
  return pixels;
}

/** RGBA rows in the other order: the bottom row first becomes the top. */
export function flipRows(
  pixels: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const row = width * 4;
  const flipped = new Uint8Array(pixels.length);
  for (let y = 0; y < height; y++) {
    flipped.set(
      pixels.subarray(y * row, (y + 1) * row),
      (height - 1 - y) * row
    );
  }
  return flipped;
}
