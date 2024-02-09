import { Mesh } from './mesh';
import { Disposable, Renderable, RenderingContext } from './rendering-context';

export class Scene implements Renderable, Disposable {
  private meshs: Mesh[] = [];
  add(mesh: Mesh) {
    this.meshs.push(mesh);
  }

  render(ctx: RenderingContext) {
    const { gl, width, height } = ctx;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, width, height);

    for (const mesh of this.meshs) {
      mesh.update(ctx);
      mesh.render(ctx);
    }
    return ctx;
  }

  dispose(gl: WebGL2RenderingContext): void {
    this.meshs.forEach((mesh) => {
      mesh.dispose(gl);
    });
  }
}
