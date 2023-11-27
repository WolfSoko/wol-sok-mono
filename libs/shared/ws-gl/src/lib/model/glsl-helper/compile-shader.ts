export function compileShader(
  type: number,
  source: string,
  gl: WebGLRenderingContext
): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error(
      `Error: Could not createShader of type: ${
        type === gl.FRAGMENT_SHADER ? 'FRAGMENT_SHADER' : 'VERTEX_SHADER'
      }`
    );
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      'An error occurred compiling the shaders:',
      gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    throw new Error(
      `Error: Could not createShader of type: ${
        type === gl.FRAGMENT_SHADER ? 'FRAGMENT_SHADER' : 'VERTEX_SHADER'
      }`
    );
  }
  return shader;
}
