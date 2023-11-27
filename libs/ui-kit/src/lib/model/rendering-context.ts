export interface RenderingContext {
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  program?: WebGLProgram;
}
export interface RenderingContextWithProgram extends RenderingContext {
  program: WebGLProgram;
}

export interface Renderable {
  render(ctx: RenderingContext): RenderingContext;
}

export interface Updateable {
  update(ctx: RenderingContext): RenderingContext;
}
export interface Disposable {
  dispose(gl: WebGL2RenderingContext): void;
}
