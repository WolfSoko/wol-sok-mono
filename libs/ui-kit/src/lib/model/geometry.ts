import {
  Renderable,
  Updateable,
  Disposable,
  RenderingContext,
  RenderingContextWithProgram,
} from './rendering-context';

export abstract class Geometry implements Renderable, Updateable, Disposable {
  abstract update(ctx: RenderingContextWithProgram): RenderingContext;

  abstract render(ctx: RenderingContextWithProgram): RenderingContext;

  abstract dispose(gl: WebGL2RenderingContext): void;
}
