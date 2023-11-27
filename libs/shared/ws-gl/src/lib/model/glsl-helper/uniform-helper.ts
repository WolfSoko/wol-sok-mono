import { Uniform1f, Uniform2f, Uniform4f, Uniform } from '../uniforms';

const uniformMap: Map<
  WebGLProgram,
  Map<string, WebGLUniformLocation>
> = new Map();

export function setUniform(
  uniform: Uniform,
  gl: WebGL2RenderingContext,
  program: WebGLProgram
) {
  const location = getUniformLocationLazy(uniform, gl, program);
  if (!location) {
    return;
  }
  switch (uniform.type) {
    case '1f':
      gl.uniform1f(location, uniform.value);
      break;
    case '2f':
      gl.uniform2f(location, uniform.value[0], uniform.value[1]);
      break;
    case '4f':
      gl.uniform4f(
        location,
        uniform.value[0],
        uniform.value[1],
        uniform.value[2],
        uniform.value[3]
      );
      break;
    default:
      throw new Error(`Unsupported uniform: ${uniform}`);
  }
}

function rememberUniform(
  program: WebGLProgram,
  uniform: Uniform1f | Uniform2f | Uniform4f,
  location: WebGLUniformLocation
): void {
  if (!uniformMap.has(program)) {
    uniformMap.set(program, new Map([[uniform.name, location]]));
  }
  uniformMap.get(program)!.set(uniform.name, location);
}

export function getUniformLocationLazy(
  uniform: Uniform1f | Uniform2f | Uniform4f,
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): WebGLUniformLocation | null {
  const uniformLocation = uniformMap.get(program)?.get(uniform.name);
  if (uniformLocation != null) {
    return uniformLocation;
  }
  const location = gl.getUniformLocation(program, uniform.name);
  if (!location) {
    // console.warn('Could not get location of', uniform);
    return null;
  }
  rememberUniform(program, uniform, location);
  return location;
}
