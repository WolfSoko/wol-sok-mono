type i8 = number;
type i16 = number;
type i32 = number;
type i64 = bigint;
type isize = number;
type u8 = number;
type u16 = number;
type u32 = number;
type u64 = bigint;
type usize = number;
type f32 = number;
type f64 = number;
type bool = boolean | number;
export function logRecCalls(v: i32): void;
export function fib(n: i32): i32;
export function fibMem(n: i32): i32;
export const memory: WebAssembly.Memory;
export const __setArgumentsLength: ((n: i32) => void) | undefined;
