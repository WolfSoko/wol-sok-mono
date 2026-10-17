/**
 * Small WebGL2 helpers shared by the arena painter and the GPU simulation,
 * which draw into the same context.
 */

/** A compiled program and the locations of the uniforms it was asked for. */
export interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

/** A texture with a framebuffer that renders into it. */
export interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

/** Compiles and links a program, throwing with the driver's log on failure. */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  uniforms: readonly string[]
): Program {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(
    program,
    createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Shader did not link: ${gl.getProgramInfoLog(program)}`);
  }
  return {
    program,
    uniforms: Object.fromEntries(
      uniforms.map((name) => [name, gl.getUniformLocation(program, name)])
    ),
  };
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (shader == null) {
    throw new Error('Could not create a shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader did not compile: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

/** An immutable 2D texture, clamped at the edges. */
export function createTexture(
  gl: WebGL2RenderingContext,
  format: number,
  width: number,
  height: number,
  filter: number
): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/** A texture to render into. Integer formats must be sampled unfiltered. */
export function createTarget(
  gl: WebGL2RenderingContext,
  format: number,
  width: number,
  height: number,
  filter: number = gl.NEAREST
): Target {
  const texture = createTexture(gl, format, width, height, filter);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer };
}

/** A unit quad, corners from 0 to 1, as a triangle strip in attribute 0. */
export function createQuad(gl: WebGL2RenderingContext): {
  vao: WebGLVertexArrayObject;
  corners: WebGLBuffer;
} {
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, corners };
}

/** A quad over the whole target, for the full screen passes. */
export const FULLSCREEN_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
out vec2 vNdc;
void main() {
  vNdc = aCorner * 2.0 - 1.0;
  gl_Position = vec4(vNdc, 0.0, 1.0);
}`;
