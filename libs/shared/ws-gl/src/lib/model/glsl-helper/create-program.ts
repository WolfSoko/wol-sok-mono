import { FragCode, VertCode } from '../glsl-code.types';
import { compileShader } from './compile-shader';

export function createProgram(
  gl: WebGLRenderingContext,
  vertexShaderCode: VertCode,
  fragmentShaderCode: FragCode
) {
  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderCode, gl);
  const fragmentShader = compileShader(
    gl.FRAGMENT_SHADER,
    fragmentShaderCode,
    gl
  );

  const shaderProgram = gl.createProgram();
  if (!shaderProgram) {
    throw Error('Unable to create the shader program');
  }

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log('Vertex shader info log:', gl.getShaderInfoLog(vertexShader));
    console.log(
      'Fragment shader info log:',
      gl.getShaderInfoLog(fragmentShader)
    );
    console.log('Program info log', gl.getProgramInfoLog(shaderProgram));
    throw Error('Unable to initialize the shader program');
  }
  return shaderProgram;
}
