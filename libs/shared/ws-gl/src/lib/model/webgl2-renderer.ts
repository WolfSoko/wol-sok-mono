import { RenderingContext } from './rendering-context';
import { Scene } from './scene';

export class WebGl2Renderer {
  width: number;
  height: number;
  private scene: Scene | null = null;
  private readonly gl2Context: WebGL2RenderingContext;

  constructor(
    private readonly context: { canvas: HTMLCanvasElement; antialias: boolean }
  ) {
    const { canvas, antialias } = this.context;
    this.width = canvas.width;
    this.height = canvas.height;

    const gl = canvas.getContext('webgl2', { antialias });
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl2Context = gl;
  }

  render(scene: Scene) {
    this.scene = scene;
    const gl: WebGL2RenderingContext = this.gl2Context;

    const context: RenderingContext = {
      gl,
      width: this.width,
      height: this.height,
    };
    scene.render(context);
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  dispose(): void {
    this.gl2Context.getExtension('WEBGL_lose_context')?.loseContext();
    this.scene?.dispose(this.gl2Context);
  }
}
