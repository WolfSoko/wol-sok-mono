import { Geometry } from './geometry';
import { Material } from './material';
import {
  Disposable,
  Renderable,
  RenderingContext,
  Updateable,
} from './rendering-context';

export class Mesh implements Renderable, Updateable, Disposable {
  constructor(
    private geometry: Geometry,
    private material: Material
  ) {}

  update(ctx: RenderingContext): RenderingContext {
    this.geometry.update(this.material.update(ctx));
    return ctx;
  }

  render(ctx: RenderingContext): RenderingContext {
    this.geometry.render(this.material.render(ctx));
    return ctx;
  }

  dispose(gl: WebGL2RenderingContext): void {
    this.geometry.dispose(gl);
    this.material.dispose(gl);
  }
}
