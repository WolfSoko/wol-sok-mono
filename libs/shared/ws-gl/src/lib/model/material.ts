import { FragCode, VertCode } from './glsl-code.types';
import { createProgram } from './glsl-helper/create-program';
import {
  Disposable,
  Renderable,
  RenderingContext,
  RenderingContextWithProgram,
  Updateable,
} from './rendering-context';

export abstract class Material implements Updateable, Renderable, Disposable {
  protected shaderProgram: WebGLProgram | null = null;

  private updateNeeded = true;

  protected constructor(
    protected vertexShader: VertCode,
    protected fragmentShader: FragCode
  ) {}

  update(ctx: RenderingContext): RenderingContextWithProgram {
    if (this.needsUpdate()) {
      this.removeProgram(ctx.gl);
      this.shaderProgram = this.initProgram(ctx);
    }
    return { ...ctx, program: this.shaderProgram! };
  }

  render(ctx: RenderingContext): RenderingContextWithProgram {
    if (!this.shaderProgram) {
      throw new Error('Cannot render without program');
    }
    const ctxWithProgram = { ...ctx, program: this.shaderProgram! };
    this.attachUniforms(ctxWithProgram);
    return ctxWithProgram;
  }

  protected abstract attachUniforms(ctx: RenderingContextWithProgram): void;

  setValues(values: { fragmentShader: FragCode }): void {
    this.fragmentShader = values.fragmentShader;
    this.updateNeeded = true;
  }

  private initProgram(ctx: RenderingContext): WebGLProgram {
    if (!this.vertexShader || !this.fragmentShader) {
      throw Error('Shaders must be initialized');
    }
    return createProgram(ctx.gl, this.vertexShader, this.fragmentShader);
  }

  public needsUpdate(): boolean {
    return !this.shaderProgram || this.updateNeeded;
  }

  dispose(gl: WebGL2RenderingContext) {
    this.removeProgram(gl);
  }

  private removeProgram(gl: WebGL2RenderingContext): void {
    gl.deleteProgram(this.shaderProgram);
  }
}
