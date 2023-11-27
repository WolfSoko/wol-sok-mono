export type Uniform = Uniform1f | Uniform2f | Uniform4f;

interface GenericUniform<TValue> {
  value: TValue;
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
