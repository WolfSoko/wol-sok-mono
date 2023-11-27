export type FragCode = string;
export type VertCode = string;
export type GlslCode = FragCode | VertCode;

// @ts-expect-error 'hacky to get typescript load string from that files'
declare module '*.glsl' {
  const value: GlslCode;
  export default value;
}

// @ts-expect-error 'hacky to get typescript load string from that files'
declare module '*.vert' {
  const value: VertCode;
  export default value;
}

// @ts-expect-error 'hacky to get typescript load string from that files'
declare module '*.frag' {
  const value: FragCode;
  export default value;
}
