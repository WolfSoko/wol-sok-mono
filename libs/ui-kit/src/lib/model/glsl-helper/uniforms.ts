export type Uniform = Uniform1f | Uniform2f | Uniform4f;

interface GenericUniform<TValue> {
  value: TValue;
  location?: WebGLUniformLocation | null;
  name: string;
}

export interface Uniform1f extends GenericUniform<number> {
  type: '1f';
}

export interface Uniform2f extends GenericUniform<[number, number]> {
  type: '2f';
}

export interface Uniform4f
  extends GenericUniform<[number, number, number, number]> {
  type: '4f';
}

export function u1f(name: string, value: number): Uniform1f {
  return { type: '1f', value, name } as Uniform1f;
}

export function u2f(name: string, value1: number, value2: number): Uniform2f {
  return { name, type: '2f', value: [value1, value2] };
}

export function u4f(
  name: string,
  value1: number,
  value2: number,
  value3: number,
  value4: number
): Uniform4f {
  return { name, type: '4f', value: [value1, value2, value3, value4] };
}

function getUniformLocationLazy(
  uniform: Uniform1f | Uniform2f | Uniform4f,
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): WebGLUniformLocation | null {
  uniform.location = gl.getUniformLocation(program, uniform.name);
  if (!uniform.location) {
    // console.warn('Could not get location of', uniform);
    return null;
  }
  return uniform.location;
}

export function setUniform(
  uniform: Uniform,
  gl: WebGL2RenderingContext,
  program: WebGLProgram
) {
  const location = getUniformLocationLazy(uniform, gl, program);
  if (!location) {
    return;
  }
  uniform.location = location;
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
